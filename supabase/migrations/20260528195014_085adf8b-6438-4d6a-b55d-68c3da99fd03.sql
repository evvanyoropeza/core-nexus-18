
-- Tabla de versiones (snapshots inmutables de cabecera + líneas + cliente)
CREATE TABLE public.quotation_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  quotation_id uuid NOT NULL,
  version_number integer NOT NULL,
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quotation_id, version_number)
);

CREATE INDEX idx_quotation_versions_quotation ON public.quotation_versions(quotation_id, version_number DESC);
CREATE INDEX idx_quotation_versions_tenant ON public.quotation_versions(tenant_id);

GRANT SELECT, INSERT ON public.quotation_versions TO authenticated;
GRANT ALL ON public.quotation_versions TO service_role;

ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qversions_select_member" ON public.quotation_versions
  FOR SELECT TO authenticated
  USING (is_member_of(auth.uid(), tenant_id));

CREATE POLICY "qversions_insert_staff" ON public.quotation_versions
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role]));

-- Tokens públicos para visualización por el cliente sin login
CREATE TABLE public.quotation_public_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  quotation_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qpt_quotation ON public.quotation_public_tokens(quotation_id);
CREATE INDEX idx_qpt_token ON public.quotation_public_tokens(token) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.quotation_public_tokens TO authenticated;
GRANT ALL ON public.quotation_public_tokens TO service_role;

ALTER TABLE public.quotation_public_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qpt_select_member" ON public.quotation_public_tokens
  FOR SELECT TO authenticated
  USING (is_member_of(auth.uid(), tenant_id));

CREATE POLICY "qpt_insert_staff" ON public.quotation_public_tokens
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role]));

CREATE POLICY "qpt_update_staff" ON public.quotation_public_tokens
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role]));

-- Storage bucket privado para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation-pdfs', 'quotation-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Lectura de PDFs solo a miembros del tenant (primer segmento del path = tenant_id)
CREATE POLICY "qpdf_select_member"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quotation-pdfs'
  AND public.is_member_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Función para duplicar cotización
CREATE OR REPLACE FUNCTION public.duplicate_quotation(_quotation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src public.quotations%ROWTYPE;
  v_new_id uuid;
  v_new_folio text;
BEGIN
  SELECT * INTO v_src FROM public.quotations WHERE id = _quotation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quotation not found'; END IF;

  IF NOT has_any_role(auth.uid(), v_src.tenant_id, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_new_folio := public.generate_quotation_folio(v_src.tenant_id);

  INSERT INTO public.quotations (
    tenant_id, folio, customer_id, customer_snapshot, status,
    issue_date, valid_until, currency, payment_terms, delivery_terms,
    notes, internal_notes, discount_pct, created_by
  ) VALUES (
    v_src.tenant_id, v_new_folio, v_src.customer_id, v_src.customer_snapshot, 'draft',
    CURRENT_DATE, v_src.valid_until, v_src.currency, v_src.payment_terms, v_src.delivery_terms,
    v_src.notes, v_src.internal_notes, v_src.discount_pct, auth.uid()
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.quotation_items (
    tenant_id, quotation_id, product_id, sku, name, description, unit,
    quantity, unit_price, discount_pct, tax_rate, position
  )
  SELECT v_src.tenant_id, v_new_id, product_id, sku, name, description, unit,
         quantity, unit_price, discount_pct, tax_rate, position
    FROM public.quotation_items
   WHERE quotation_id = _quotation_id
   ORDER BY position;

  RETURN v_new_id;
END;
$$;

-- Función para crear snapshot inmutable
CREATE OR REPLACE FUNCTION public.snapshot_quotation_version(_quotation_id uuid, _reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_next integer;
  v_snapshot jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.quotations WHERE id = _quotation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quotation not found'; END IF;
  IF NOT has_any_role(auth.uid(), v_tenant, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
    FROM public.quotation_versions WHERE quotation_id = _quotation_id;

  SELECT jsonb_build_object(
    'header', to_jsonb(q.*),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.position)
        FROM public.quotation_items i WHERE i.quotation_id = q.id
    ), '[]'::jsonb)
  ) INTO v_snapshot
  FROM public.quotations q WHERE q.id = _quotation_id;

  INSERT INTO public.quotation_versions (tenant_id, quotation_id, version_number, reason, snapshot, created_by)
  VALUES (v_tenant, _quotation_id, v_next, _reason, v_snapshot, auth.uid());

  RETURN v_next;
END;
$$;
