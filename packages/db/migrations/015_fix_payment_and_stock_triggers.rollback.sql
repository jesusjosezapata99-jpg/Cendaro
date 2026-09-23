-- Rollback of 015_fix_payment_and_stock_triggers.sql
-- Restores both functions and the stock trigger exactly as they were in
-- production on 2026-09-17 (pg_get_functiondef / pg_get_triggerdef).
-- Warning: this reinstates the defects 015 fixed — every INSERT INTO payment
-- and INTO stock_movement fails again.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_ar_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Reduce balance on the AR linked to this payment's order
  UPDATE account_receivable
  SET
    balance = GREATEST(balance - NEW.amount_usd, 0),
    status = CASE
      WHEN GREATEST(balance - NEW.amount_usd, 0) = 0 THEN 'paid'
      ELSE status
    END,
    updated_at = now()
  WHERE order_id = NEW.order_id
    AND status IN ('pending', 'overdue');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_delta int;
BEGIN
  -- Determine direction based on movement type
  CASE NEW.movement_type
    WHEN 'purchase', 'return_in', 'adjustment_in', 'transfer_in' THEN
      v_delta := NEW.quantity;
    WHEN 'sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage' THEN
      v_delta := -NEW.quantity;
    ELSE
      v_delta := 0;
  END CASE;

  -- Upsert stock ledger: insert if not exists, update if exists
  INSERT INTO stock_ledger (id, product_id, warehouse_id, quantity)
  VALUES (gen_random_uuid(), NEW.product_id, NEW.warehouse_id, GREATEST(v_delta, 0))
  ON CONFLICT (product_id, warehouse_id) DO UPDATE
  SET quantity = stock_ledger.quantity + v_delta,
      updated_at = now();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION
  public.update_ar_on_payment(),
  public.apply_stock_movement()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.stock_movement
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

COMMIT;
