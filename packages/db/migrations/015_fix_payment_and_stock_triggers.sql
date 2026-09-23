-- Cendaro ERP — Fix the triggers that rejected every payment and stock movement
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F2 (atomic POS checkout)
--
-- Production evidence (read-only, 2026-09-17): 1,202 sales orders but 0
-- payment rows, 0 stock_movement rows and 0 'payment.create' audit entries.
-- Nothing the app inserted into either table ever committed:
--
-- 1. trg_ar_payment → update_ar_on_payment() reads NEW.amount_usd and writes
--    account_receivable.updated_at; neither column exists (payment.amount is
--    already in USD, account_receivable has no updated_at). PL/pgSQL resolves
--    both when the trigger fires, so every INSERT INTO payment failed. The POS
--    hid the error. Fixed to use NEW.amount, drop updated_at, keep
--    account_receivable.paid_amount in step with balance, and include
--    'partial' receivables (the original skipped them after a first payment).
--
-- 2. trg_apply_movement → apply_stock_movement() upserts stock_ledger with
--    ON CONFLICT (product_id, warehouse_id), but the only matching unique
--    index is uq_stock_product_warehouse (workspace_id, product_id,
--    warehouse_id), so every INSERT INTO stock_movement failed with 42P10.
--    Repairing the upsert would not help: the imports already write
--    stock_ledger explicitly before logging the movement (inventory-import.ts,
--    catalog-import.ts), so a working trigger would apply each change twice;
--    channel movements (transfers, sales) carry no warehouse_id, which
--    stock_ledger requires; and its CASE names movement types that do not
--    exist in movement_type. stock_movement is the app's traceability log, so
--    the trigger and its function are dropped.
--
-- update_ar_on_payment keeps SECURITY DEFINER and its pinned search_path.
-- CREATE OR REPLACE preserves 005's REVOKE EXECUTE; it is restated here.
--
-- Rollback: 015_fix_payment_and_stock_triggers.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.update_ar_on_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Apply the payment to the open receivable of the same order and workspace
  -- (SECURITY DEFINER bypasses RLS, so the workspace is matched explicitly).
  -- Fully paid (within half a cent of float8 rounding) → 'paid' with a zero
  -- balance; a partial payment on a 'pending' receivable → 'partial'; an
  -- overdue receivable stays 'overdue' until it is paid, so it keeps showing
  -- as overdue. payment.amount is expressed in USD.
  UPDATE account_receivable
  SET
    paid_amount = paid_amount + NEW.amount,
    balance = CASE
      WHEN balance - NEW.amount <= 0.005 THEN 0
      ELSE balance - NEW.amount
    END,
    status = CASE
      WHEN balance - NEW.amount <= 0.005 THEN 'paid'::ar_status
      WHEN status = 'pending' THEN 'partial'::ar_status
      ELSE status
    END
  WHERE order_id = NEW.order_id
    AND workspace_id = NEW.workspace_id
    AND status IN ('pending', 'partial', 'overdue');

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_ar_on_payment()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_apply_movement ON public.stock_movement;
DROP FUNCTION IF EXISTS public.apply_stock_movement();

COMMIT;
