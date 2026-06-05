
-- Automatic stock exit when sales order lines are fulfilled
CREATE OR REPLACE FUNCTION public.auto_stock_exit_from_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta numeric(14,4);
  v_product public.products%ROWTYPE;
  v_folio text;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.quantity_fulfilled,0) - COALESCE(OLD.quantity_fulfilled,0);
  IF v_delta <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND OR v_product.type = 'service' OR COALESCE(v_product.track_stock, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT folio INTO v_folio FROM public.sales_orders WHERE id = NEW.order_id;

  INSERT INTO public.stock_movements (
    tenant_id, product_id, movement_type, quantity,
    reason, reference, created_by
  ) VALUES (
    NEW.tenant_id, NEW.product_id, 'exit', v_delta,
    'Salida automática por surtido de orden',
    COALESCE(v_folio, NEW.order_id::text),
    auth.uid()
  );

  RETURN NEW;
END;
$$;

-- If products table doesn't have track_stock, the COALESCE(..., true) above still works only if column exists.
-- Drop+recreate function without track_stock reference if column missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='track_stock') THEN
    CREATE OR REPLACE FUNCTION public.auto_stock_exit_from_order_item()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    DECLARE
      v_delta numeric(14,4);
      v_product public.products%ROWTYPE;
      v_folio text;
    BEGIN
      IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
      v_delta := COALESCE(NEW.quantity_fulfilled,0) - COALESCE(OLD.quantity_fulfilled,0);
      IF v_delta <= 0 THEN RETURN NEW; END IF;
      SELECT * INTO v_product FROM public.products WHERE id = NEW.product_id;
      IF NOT FOUND OR v_product.type = 'service' THEN RETURN NEW; END IF;
      SELECT folio INTO v_folio FROM public.sales_orders WHERE id = NEW.order_id;
      INSERT INTO public.stock_movements (
        tenant_id, product_id, movement_type, quantity,
        reason, reference, created_by
      ) VALUES (
        NEW.tenant_id, NEW.product_id, 'exit', v_delta,
        'Salida automática por surtido de orden',
        COALESCE(v_folio, NEW.order_id::text),
        auth.uid()
      );
      RETURN NEW;
    END;
    $f$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_auto_stock_exit_on_fulfill ON public.sales_order_items;
CREATE TRIGGER trg_auto_stock_exit_on_fulfill
  AFTER UPDATE OF quantity_fulfilled ON public.sales_order_items
  FOR EACH ROW
  WHEN (NEW.quantity_fulfilled IS DISTINCT FROM OLD.quantity_fulfilled)
  EXECUTE FUNCTION public.auto_stock_exit_from_order_item();
