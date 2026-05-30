
-- Estado de la orden
DO $$ BEGIN
  CREATE TYPE public.sales_order_status AS ENUM ('draft','confirmed','in_progress','fulfilled','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Folio para órdenes en organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS order_folio_prefix text NOT NULL DEFAULT 'SO',
  ADD COLUMN IF NOT EXISTS order_folio_next integer NOT NULL DEFAULT 1;

-- Tabla principal
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  folio text NOT NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL,
  customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.sales_order_status NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  currency text NOT NULL DEFAULT 'MXN',
  payment_terms text,
  delivery_terms text,
  notes text,
  internal_notes text,
  discount_pct numeric(6,3) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid,
  confirmed_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, folio)
);

CREATE INDEX IF NOT EXISTS sales_orders_tenant_idx ON public.sales_orders(tenant_id);
CREATE INDEX IF NOT EXISTS sales_orders_customer_idx ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS sales_orders_quotation_idx ON public.sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS sales_orders_status_idx ON public.sales_orders(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_select_member ON public.sales_orders
  FOR SELECT TO authenticated USING (is_member_of(auth.uid(), tenant_id));
CREATE POLICY orders_insert_staff ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY orders_update_staff ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY orders_delete_admin ON public.sales_orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), tenant_id, 'admin'::app_role));

-- Líneas
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid,
  sku text,
  name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'pza',
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  quantity_fulfilled numeric(14,4) NOT NULL DEFAULT 0,
  unit_price numeric(14,4) NOT NULL DEFAULT 0,
  discount_pct numeric(6,3) NOT NULL DEFAULT 0,
  tax_rate numeric(6,3) NOT NULL DEFAULT 16,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_order_items_order_idx ON public.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS sales_order_items_tenant_idx ON public.sales_order_items(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_items TO authenticated;
GRANT ALL ON public.sales_order_items TO service_role;

ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY oitems_select_member ON public.sales_order_items
  FOR SELECT TO authenticated USING (is_member_of(auth.uid(), tenant_id));
CREATE POLICY oitems_insert_staff ON public.sales_order_items
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY oitems_update_staff ON public.sales_order_items
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));
CREATE POLICY oitems_delete_staff ON public.sales_order_items
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]));

-- Folio de órdenes
CREATE OR REPLACE FUNCTION public.generate_order_folio(_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefix text; v_next integer;
BEGIN
  IF NOT is_member_of(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.organization_settings
    SET order_folio_next = order_folio_next + 1
    WHERE tenant_id = _tenant_id
    RETURNING order_folio_prefix, order_folio_next - 1 INTO v_prefix, v_next;
  IF v_prefix IS NULL THEN
    INSERT INTO public.organization_settings(tenant_id, order_folio_prefix, order_folio_next)
      VALUES (_tenant_id, 'SO', 2)
      RETURNING order_folio_prefix INTO v_prefix;
    v_next := 1;
  END IF;
  RETURN v_prefix || '-' || LPAD(v_next::text, 5, '0');
END; $$;

-- Recalculo totales de orden
CREATE OR REPLACE FUNCTION public.recalc_order_totals(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subtotal numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_discount_pct numeric(6,3);
  v_discount_amount numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
BEGIN
  SELECT COALESCE(SUM(subtotal),0), COALESCE(SUM(tax_amount),0)
    INTO v_subtotal, v_tax
    FROM public.sales_order_items WHERE order_id = _order_id;
  SELECT discount_pct INTO v_discount_pct FROM public.sales_orders WHERE id = _order_id;
  v_discount_amount := ROUND(v_subtotal * COALESCE(v_discount_pct,0) / 100, 2);
  v_total := v_subtotal - v_discount_amount + v_tax;
  UPDATE public.sales_orders
    SET subtotal = v_subtotal, discount_amount = v_discount_amount,
        tax_amount = v_tax, total = v_total, updated_at = now()
    WHERE id = _order_id;
END; $$;

-- Trigger línea: computa subtotal/impuesto y refresca cabecera
CREATE OR REPLACE FUNCTION public.order_item_compute()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_gross numeric(14,4); v_net numeric(14,4);
BEGIN
  v_gross := COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0);
  v_net := v_gross * (1 - COALESCE(NEW.discount_pct,0)/100);
  NEW.subtotal := ROUND(v_net, 2);
  NEW.tax_amount := ROUND(v_net * COALESCE(NEW.tax_rate,0)/100, 2);
  NEW.total := NEW.subtotal + NEW.tax_amount;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.order_item_refresh_header()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_oid uuid;
BEGIN
  v_oid := COALESCE(NEW.order_id, OLD.order_id);
  PERFORM public.recalc_order_totals(v_oid);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.order_header_refresh()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.discount_pct IS DISTINCT FROM OLD.discount_pct THEN
    PERFORM public.recalc_order_totals(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_order_item_compute ON public.sales_order_items;
CREATE TRIGGER trg_order_item_compute
  BEFORE INSERT OR UPDATE ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_item_compute();

DROP TRIGGER IF EXISTS trg_order_item_refresh ON public.sales_order_items;
CREATE TRIGGER trg_order_item_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_item_refresh_header();

DROP TRIGGER IF EXISTS trg_order_header_refresh ON public.sales_orders;
CREATE TRIGGER trg_order_header_refresh
  AFTER UPDATE OF discount_pct ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.order_header_refresh();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.sales_orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Conversión de cotización a orden
CREATE OR REPLACE FUNCTION public.convert_quotation_to_order(_quotation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q public.quotations%ROWTYPE;
  v_existing uuid;
  v_new_id uuid;
  v_folio text;
BEGIN
  SELECT * INTO v_q FROM public.quotations WHERE id = _quotation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quotation not found'; END IF;

  IF NOT has_any_role(auth.uid(), v_q.tenant_id, ARRAY['admin'::app_role,'sales'::app_role,'operations'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_q.status IN ('rejected','expired') THEN
    RAISE EXCEPTION 'Cannot convert quotation in status %', v_q.status;
  END IF;

  SELECT id INTO v_existing FROM public.sales_orders
    WHERE quotation_id = _quotation_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_folio := public.generate_order_folio(v_q.tenant_id);

  INSERT INTO public.sales_orders (
    tenant_id, folio, quotation_id, customer_id, customer_snapshot, status,
    issue_date, currency, payment_terms, delivery_terms, notes, internal_notes,
    discount_pct, created_by
  ) VALUES (
    v_q.tenant_id, v_folio, v_q.id, v_q.customer_id, v_q.customer_snapshot, 'confirmed',
    CURRENT_DATE, v_q.currency, v_q.payment_terms, v_q.delivery_terms, v_q.notes, v_q.internal_notes,
    v_q.discount_pct, auth.uid()
  ) RETURNING id INTO v_new_id;

  UPDATE public.sales_orders SET confirmed_at = now() WHERE id = v_new_id;

  INSERT INTO public.sales_order_items (
    tenant_id, order_id, product_id, sku, name, description, unit,
    quantity, unit_price, discount_pct, tax_rate, position
  )
  SELECT v_q.tenant_id, v_new_id, product_id, sku, name, description, unit,
         quantity, unit_price, discount_pct, tax_rate, position
    FROM public.quotation_items
   WHERE quotation_id = _quotation_id
   ORDER BY position;

  -- Marcar cotización como aceptada si aún no lo está
  IF v_q.status <> 'accepted' THEN
    UPDATE public.quotations
       SET status = 'accepted', decided_at = now(), updated_at = now()
     WHERE id = _quotation_id;
  END IF;

  -- Snapshot de versión
  PERFORM public.snapshot_quotation_version(_quotation_id, 'converted_to_order:' || v_folio);

  RETURN v_new_id;
END; $$;
