
REVOKE EXECUTE ON FUNCTION public.duplicate_quotation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_quotation(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.snapshot_quotation_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_quotation_version(uuid, text) TO authenticated;
