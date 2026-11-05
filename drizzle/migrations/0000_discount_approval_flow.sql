ALTER TABLE public.quotations
  ADD COLUMN approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN approval_requested_by uuid,
  ADD COLUMN approval_requested_at timestamptz,
  ADD COLUMN approval_decided_by uuid,
  ADD COLUMN approval_decided_at timestamptz,
  ADD COLUMN approval_note text,
  ADD COLUMN approved_discount_pct numeric;

ALTER TABLE public.quotations ADD CONSTRAINT quotations_approval_status_chk
  CHECK (approval_status IN ('not_required','pending','approved','rejected'));

CREATE OR REPLACE FUNCTION public.quotation_max_discount(_quotation_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(
    COALESCE((SELECT discount_pct FROM public.quotations WHERE id = _quotation_id), 0),
    COALESCE((SELECT MAX(discount_pct) FROM public.quotation_items WHERE quotation_id = _quotation_id), 0)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.quotation_max_discount(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quotation_max_discount(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_discount_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('sent','accepted','converted') THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_any_role(auth.uid(), NEW.tenant_id, ARRAY['superadmin','admin']::app_role[]) THEN
      _max := public.quotation_max_discount(NEW.id);
      IF _max > 15 AND NOT (NEW.approval_status = 'approved' AND COALESCE(NEW.approved_discount_pct,0) >= _max) THEN
        RAISE EXCEPTION 'Esta cotización tiene un descuento de %%%  y requiere autorización de un administrador', round(_max,2);
      END IF;
    END IF;
  END IF;
  -- non-admins cannot self-approve
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status AND NEW.approval_status IN ('approved','rejected')
     AND auth.uid() IS NOT NULL
     AND NOT public.has_any_role(auth.uid(), NEW.tenant_id, ARRAY['superadmin','admin']::app_role[]) THEN
    RAISE EXCEPTION 'Solo un administrador puede autorizar descuentos';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_discount_approval() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_discount_approval
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.enforce_discount_approval();

CREATE OR REPLACE FUNCTION public.request_discount_approval(_quotation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t uuid; _max numeric;
BEGIN
  SELECT tenant_id INTO _t FROM public.quotations WHERE id = _quotation_id;
  IF _t IS NULL OR NOT public.is_member_of(auth.uid(), _t) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  _max := public.quotation_max_discount(_quotation_id);
  UPDATE public.quotations SET approval_status = 'pending', approval_requested_by = auth.uid(),
    approval_requested_at = now(), approval_decided_by = NULL, approval_decided_at = NULL,
    approval_note = NULL, approved_discount_pct = NULL
  WHERE id = _quotation_id;
  PERFORM public.log_audit_event(_t, 'quotation.discount_requested', 'quotation', _quotation_id::text, jsonb_build_object('discount_pct', _max));
END $$;

CREATE OR REPLACE FUNCTION public.decide_discount_approval(_quotation_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t uuid; _max numeric;
BEGIN
  SELECT tenant_id INTO _t FROM public.quotations WHERE id = _quotation_id;
  IF _t IS NULL OR NOT public.has_any_role(auth.uid(), _t, ARRAY['superadmin','admin']::app_role[]) THEN
    RAISE EXCEPTION 'Solo un administrador puede autorizar descuentos';
  END IF;
  _max := public.quotation_max_discount(_quotation_id);
  UPDATE public.quotations SET
    approval_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    approval_decided_by = auth.uid(), approval_decided_at = now(),
    approval_note = NULLIF(left(trim(COALESCE(_note,'')), 1000), ''),
    approved_discount_pct = CASE WHEN _approve THEN _max ELSE NULL END
  WHERE id = _quotation_id;
  PERFORM public.log_audit_event(_t, CASE WHEN _approve THEN 'quotation.discount_approved' ELSE 'quotation.discount_rejected' END,
    'quotation', _quotation_id::text, jsonb_build_object('discount_pct', _max, 'note', _note));
END $$;

REVOKE EXECUTE ON FUNCTION public.request_discount_approval(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_discount_approval(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_discount_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_discount_approval(uuid, boolean, text) TO authenticated;