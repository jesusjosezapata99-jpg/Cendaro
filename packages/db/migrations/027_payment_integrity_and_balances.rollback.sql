-- Rollback for 027_payment_integrity_and_balances.sql
-- customer.balance keeps its current values: revert them from the listing saved
-- before the reconciliation if that step already ran.

BEGIN;

DROP INDEX IF EXISTS public.uq_account_receivable_open_order;

GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO anon, authenticated;

ALTER TABLE public.account_receivable
  DROP CONSTRAINT IF EXISTS ck_account_receivable_balance_non_negative;
ALTER TABLE public.payment DROP CONSTRAINT IF EXISTS ck_payment_amount_positive;
ALTER TABLE public.stock_ledger
  DROP CONSTRAINT IF EXISTS ck_stock_ledger_quantity_non_negative;

DROP INDEX IF EXISTS public.uq_payment_idempotency_key;
ALTER TABLE public.payment DROP COLUMN IF EXISTS idempotency_key;
DROP INDEX IF EXISTS public.uq_payment_order_reference;

DROP TRIGGER IF EXISTS trg_sync_customer_balance ON public.account_receivable;
DROP FUNCTION IF EXISTS public.sync_customer_balance();

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

DROP TRIGGER IF EXISTS trg_ar_payment ON public.payment;
CREATE TRIGGER trg_ar_payment
  AFTER INSERT ON public.payment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ar_on_payment();

COMMIT;
