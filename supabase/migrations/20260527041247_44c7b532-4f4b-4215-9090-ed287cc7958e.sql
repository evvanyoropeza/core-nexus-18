
-- Enum de estados
CREATE TYPE public.quotation_status AS ENUM ('draft','sent','accepted','rejected','expired','converted');

-- Cabecera
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  folio text NOT NULL,
  customer_id uuid NOT NULL,
  customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.quotation_status NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  currency text NOT NULL DEFAULT 'MXN',
  payment_terms text,
  delivery_terms text,
  notes text,
  internal_notes text,
  discount_pct numeric(6,3) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  sent_at timestamptz,
  decided_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, folio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotations_select_member ON public.quotations FOR SELECT
  USING (is_member_of(auth.uid(), tenant_id));
CREATE POLICY quotations_insert_staff ON public.quotations FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY quotations_update_staff ON public.quotations FOR UPDATE
  USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY quotations_delete_admin ON public.quotations FOR DELETE
  USING (has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE INDEX idx_quotations_tenant_status ON public.quotations(tenant_id, status);
CREATE INDEX idx_quotations_customer ON public.quotations(customer_id);
CREATE INDEX idx_quotations_issue ON public.quotations(tenant_id, issue_date DESC);

-- Líneas
CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id uuid,
  sku text,
  name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'pza',
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit_price numeric(14,4) NOT NULL DEFAULT 0,
  discount_pct numeric(6,3) NOT NULL DEFAULT 0,
  tax_rate numeric(6,3) NOT NULL DEFAULT 16,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotation_items TO service_role;

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY qitems_select_member ON public.quotation_items FOR SELECT
  USING (is_member_of(auth.uid(), tenant_id));
CREATE POLICY qitems_insert_staff ON public.quotation_items FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY qitems_update_staff ON public.quotation_items FOR UPDATE
  USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY qitems_delete_staff ON public.quotation_items FOR DELETE
  USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));

CREATE INDEX idx_qitems_quotation ON public.quotation_items(quotation_id, position);

-- Updated_at trigger (reuse helper if exists, else create)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_quotations_updated
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Folio generator
CREATE OR REPLACE FUNCTION public.generate_quotation_folio(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next integer;
BEGIN
  IF NOT is_member_of(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.organization_settings
     SET folio_next = folio_next + 1
   WHERE tenant_id = _tenant_id
   RETURNING folio_prefix, folio_next - 1 INTO v_prefix, v_next;

  IF v_prefix IS NULL THEN
    -- Create defaults if missing
    INSERT INTO public.organization_settings(tenant_id, folio_prefix, folio_next)
      VALUES (_tenant_id, 'COT', 2)
      RETURNING folio_prefix INTO v_prefix;
    v_next := 1;
  END IF;

  RETURN v_prefix || '-' || LPAD(v_next::text, 5, '0');
END;
$$;

-- Recalculate header totals from items
CREATE OR REPLACE FUNCTION public.recalc_quotation_totals(_quotation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_discount_pct numeric(6,3);
  v_discount_amount numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
BEGIN
  SELECT COALESCE(SUM(subtotal),0), COALESCE(SUM(tax_amount),0)
    INTO v_subtotal, v_tax
    FROM public.quotation_items
   WHERE quotation_id = _quotation_id;

  SELECT discount_pct INTO v_discount_pct
    FROM public.quotations WHERE id = _quotation_id;

  v_discount_amount := ROUND(v_subtotal * COALESCE(v_discount_pct,0) / 100, 2);
  v_total := v_subtotal - v_discount_amount + v_tax;

  UPDATE public.quotations
     SET subtotal = v_subtotal,
         discount_amount = v_discount_amount,
         tax_amount = v_tax,
         total = v_total,
         updated_at = now()
   WHERE id = _quotation_id;
END;
$$;

-- Trigger to compute line totals and refresh header
CREATE OR REPLACE FUNCTION public.quotation_item_compute()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_gross numeric(14,4);
  v_net numeric(14,4);
BEGIN
  v_gross := COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0);
  v_net := v_gross * (1 - COALESCE(NEW.discount_pct,0)/100);
  NEW.subtotal := ROUND(v_net, 2);
  NEW.tax_amount := ROUND(v_net * COALESCE(NEW.tax_rate,0)/100, 2);
  NEW.total := NEW.subtotal + NEW.tax_amount;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_qitems_compute
  BEFORE INSERT OR UPDATE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.quotation_item_compute();

CREATE OR REPLACE FUNCTION public.quotation_item_refresh_header()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_qid uuid;
BEGIN
  v_qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  PERFORM public.recalc_quotation_totals(v_qid);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_qitems_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.quotation_item_refresh_header();

-- Also refresh header totals when discount_pct changes
CREATE OR REPLACE FUNCTION public.quotation_header_refresh()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.discount_pct IS DISTINCT FROM OLD.discount_pct THEN
    PERFORM public.recalc_quotation_totals(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quotation_header_refresh
  AFTER UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.quotation_header_refresh();
