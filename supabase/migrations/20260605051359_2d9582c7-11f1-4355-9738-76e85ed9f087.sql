
CREATE TYPE public.stock_movement_type AS ENUM ('entry', 'exit', 'adjustment');

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type public.stock_movement_type NOT NULL,
  quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
  resulting_stock numeric(14,4) NOT NULL,
  reason text,
  reference text,
  unit_cost numeric(14,4),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_tenant ON public.stock_movements(tenant_id, created_at DESC);

GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stock movements"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), tenant_id));

CREATE POLICY "Authorized roles can insert stock movements"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), tenant_id, ARRAY['admin'::app_role, 'operations'::app_role, 'sales'::app_role])
    AND created_by = auth.uid()
  );

-- Trigger: apply movement to product stock, store resulting stock
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_new_stock numeric(14,4);
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_product.tenant_id <> NEW.tenant_id THEN RAISE EXCEPTION 'Tenant mismatch'; END IF;
  IF v_product.type = 'service' THEN RAISE EXCEPTION 'Cannot adjust stock for a service'; END IF;

  IF NEW.movement_type = 'entry' THEN
    v_new_stock := COALESCE(v_product.stock_current, 0) + NEW.quantity;
  ELSIF NEW.movement_type = 'exit' THEN
    v_new_stock := COALESCE(v_product.stock_current, 0) - NEW.quantity;
    IF v_new_stock < 0 THEN
      RAISE EXCEPTION 'Insufficient stock: current %, requested %', v_product.stock_current, NEW.quantity;
    END IF;
  ELSIF NEW.movement_type = 'adjustment' THEN
    -- quantity represents the new absolute stock level
    v_new_stock := NEW.quantity;
  END IF;

  UPDATE public.products
    SET stock_current = v_new_stock, updated_at = now()
    WHERE id = NEW.product_id;

  NEW.resulting_stock := v_new_stock;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();
