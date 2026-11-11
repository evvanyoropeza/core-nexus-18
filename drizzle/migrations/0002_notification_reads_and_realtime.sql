CREATE TABLE public.notification_reads (
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 300),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id, event_key)
);
GRANT SELECT, INSERT ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_reads_select_own ON public.notification_reads FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.is_member_of(auth.uid(), tenant_id));
CREATE POLICY notification_reads_insert_own ON public.notification_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_member_of(auth.uid(), tenant_id));
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['products', 'quotations', 'sales_orders', 'notification_reads'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;