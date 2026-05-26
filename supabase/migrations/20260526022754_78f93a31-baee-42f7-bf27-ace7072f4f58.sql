-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'MX',
  postal_code TEXT,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_days INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_customers_name ON public.customers(tenant_id, lower(name));
CREATE INDEX idx_customers_email ON public.customers(tenant_id, lower(email));
CREATE INDEX idx_customers_tags ON public.customers USING GIN(tags);
CREATE INDEX idx_customers_active ON public.customers(tenant_id, is_active);

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_select_member ON public.customers
  FOR SELECT USING (public.is_member_of(auth.uid(), tenant_id));

CREATE POLICY customers_insert_staff ON public.customers
  FOR INSERT WITH CHECK (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
  );

CREATE POLICY customers_update_staff ON public.customers
  FOR UPDATE USING (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
  ) WITH CHECK (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
  );

CREATE POLICY customers_delete_admin ON public.customers
  FOR DELETE USING (public.has_role(auth.uid(), tenant_id, 'admin'::app_role));

-- CUSTOMER CONTACTS
CREATE TABLE public.customer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_customer ON public.customer_contacts(customer_id);
CREATE INDEX idx_contacts_tenant ON public.customer_contacts(tenant_id);

CREATE TRIGGER trg_contacts_updated_at
BEFORE UPDATE ON public.customer_contacts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_select_member ON public.customer_contacts
  FOR SELECT USING (public.is_member_of(auth.uid(), tenant_id));

CREATE POLICY contacts_insert_staff ON public.customer_contacts
  FOR INSERT WITH CHECK (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
  );

CREATE POLICY contacts_update_staff ON public.customer_contacts
  FOR UPDATE USING (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
  ) WITH CHECK (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
  );

CREATE POLICY contacts_delete_staff ON public.customer_contacts
  FOR DELETE USING (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
  );

-- CUSTOMER NOTES
CREATE TABLE public.customer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_customer ON public.customer_notes(customer_id, created_at DESC);
CREATE INDEX idx_notes_tenant ON public.customer_notes(tenant_id);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_select_member ON public.customer_notes
  FOR SELECT USING (public.is_member_of(auth.uid(), tenant_id));

CREATE POLICY notes_insert_staff ON public.customer_notes
  FOR INSERT WITH CHECK (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[])
    AND author_id = auth.uid()
  );

CREATE POLICY notes_delete_admin ON public.customer_notes
  FOR DELETE USING (public.has_role(auth.uid(), tenant_id, 'admin'::app_role));