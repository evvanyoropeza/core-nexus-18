
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_categories_tenant ON public.product_categories(tenant_id);
CREATE INDEX idx_product_categories_parent ON public.product_categories(parent_id);

CREATE TYPE public.product_type AS ENUM ('product', 'service');

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type public.product_type NOT NULL DEFAULT 'product',
  unit TEXT NOT NULL DEFAULT 'pza',
  list_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  stock_min NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock_current NUMERIC(14,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_tags ON public.products USING GIN(tags);
CREATE INDEX idx_products_name_trgm ON public.products USING GIN(name gin_trgm_ops);

CREATE TABLE public.product_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity NUMERIC(14,2) NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_price_tiers_product ON public.product_price_tiers(product_id);

CREATE TRIGGER tg_product_categories_updated BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_select_member ON public.product_categories FOR SELECT
  USING (public.is_member_of(auth.uid(), tenant_id));
CREATE POLICY categories_insert_staff ON public.product_categories FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]));
CREATE POLICY categories_update_staff ON public.product_categories FOR UPDATE
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]));
CREATE POLICY categories_delete_admin ON public.product_categories FOR DELETE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY products_select_member ON public.products FOR SELECT
  USING (public.is_member_of(auth.uid(), tenant_id));
CREATE POLICY products_insert_staff ON public.products FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]));
CREATE POLICY products_update_staff ON public.products FOR UPDATE
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]));
CREATE POLICY products_delete_admin ON public.products FOR DELETE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY tiers_select_member ON public.product_price_tiers FOR SELECT
  USING (public.is_member_of(auth.uid(), tenant_id));
CREATE POLICY tiers_insert_staff ON public.product_price_tiers FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]));
CREATE POLICY tiers_update_staff ON public.product_price_tiers FOR UPDATE
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]));
CREATE POLICY tiers_delete_staff ON public.product_price_tiers FOR DELETE
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['admin','sales','operations']::app_role[]));
