-- 1) Move pg_trgm out of public
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 2) Fix mutable search_path
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3) Revoke EXECUTE from anon/public on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, uuid, app_role[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tenant_has_feature(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_subscription(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_folio(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_quotation_folio(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.convert_quotation_to_order(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_quotation(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.snapshot_quotation_version(uuid, text) FROM anon, PUBLIC;

-- Internal-only functions: no client execution at all
REVOKE EXECUTE ON FUNCTION public.recalc_order_totals(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_quotation_totals(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_suspend_expired_trials() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_stock_exit_from_order_item() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_subscription_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_user_tenant_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_feature_override() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_feature_gate() FROM anon, authenticated, PUBLIC;

-- 4) audit_logs: no direct inserts; use controlled SECURITY DEFINER function
DROP POLICY IF EXISTS audit_logs_insert_member ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _tenant_id uuid,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_member_of(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _action IS NULL OR length(_action) = 0 OR length(_action) > 100 THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    _tenant_id,
    auth.uid(),
    _action,
    NULLIF(left(COALESCE(_entity_type, ''), 100), ''),
    NULLIF(left(COALESCE(_entity_id, ''), 200), ''),
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) TO authenticated;

-- 5) quotation_public_tokens: allow hard delete by staff
CREATE POLICY qpt_delete_staff ON public.quotation_public_tokens
FOR DELETE TO authenticated
USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role]));

-- 6) storage: restrict writes on quotation-pdfs to staff of the owning tenant
DROP POLICY IF EXISTS qpdf_insert_staff ON storage.objects;
DROP POLICY IF EXISTS qpdf_update_staff ON storage.objects;
DROP POLICY IF EXISTS qpdf_delete_staff ON storage.objects;

CREATE POLICY qpdf_insert_staff ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quotation-pdfs'
  AND has_any_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role])
);

CREATE POLICY qpdf_update_staff ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'quotation-pdfs'
  AND has_any_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role])
)
WITH CHECK (
  bucket_id = 'quotation-pdfs'
  AND has_any_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role])
);

CREATE POLICY qpdf_delete_staff ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'quotation-pdfs'
  AND has_any_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['admin'::app_role, 'sales'::app_role, 'operations'::app_role])
);