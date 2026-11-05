CREATE OR REPLACE FUNCTION public.enforce_discount_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('sent','accepted','converted') THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_any_role(auth.uid(), NEW.tenant_id, ARRAY['superadmin','admin']::app_role[]) THEN
      _max := public.quotation_max_discount(NEW.id);
      IF _max > 15 AND NOT (NEW.approval_status = 'approved' AND COALESCE(NEW.approved_discount_pct,0) >= _max) THEN
        RAISE EXCEPTION 'Esta cotización tiene un descuento de % %% y requiere autorización de un administrador', round(_max,2);
      END IF;
    END IF;
  END IF;
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status AND NEW.approval_status IN ('approved','rejected')
     AND auth.uid() IS NOT NULL
     AND NOT public.has_any_role(auth.uid(), NEW.tenant_id, ARRAY['superadmin','admin']::app_role[]) THEN
    RAISE EXCEPTION 'Solo un administrador puede autorizar descuentos';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_discount_approval() FROM PUBLIC, anon, authenticated;