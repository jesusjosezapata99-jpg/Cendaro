-- Cendaro ERP — Payment integrity and customer balances
--
-- A single writer for each balance:
--  * account_receivable.paid_amount / balance move through trg_ar_payment, and
--    only once a payment is validated (at insert or on the later transition).
--  * customer.balance follows account_receivable through trg_sync_customer_balance.
-- The same bank reference cannot be recorded twice on an order, and retries
-- carrying an idempotency key cannot create a second payment.
--
-- Rollback: 027_payment_integrity_and_balances.rollback.sql

BEGIN;

-- Until now a payment moved its receivable when inserted, validated or not.
-- Validating one of those after this migration would move it a second time.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payment p
    JOIN public.account_receivable ar ON ar.order_id = p.order_id
    WHERE NOT COALESCE(p.is_validated, false)
  ) THEN
    RAISE EXCEPTION 'Unvalidated payments on orders with a receivable must be resolved first';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ar_on_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT COALESCE(NEW.is_validated, false) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_validated, false) THEN
    RETURN NEW;
  END IF;

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
  FROM PUBLIC, anon, authenticated, app_user;

DROP TRIGGER IF EXISTS trg_ar_payment ON public.payment;
CREATE TRIGGER trg_ar_payment
  AFTER INSERT OR UPDATE OF is_validated ON public.payment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ar_on_payment();

CREATE OR REPLACE FUNCTION public.sync_customer_balance()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.customer_id IS NOT NULL THEN
    UPDATE customer
    SET balance = GREATEST(0, COALESCE(balance, 0) - COALESCE(OLD.balance, 0))
    WHERE id = OLD.customer_id AND workspace_id = OLD.workspace_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.customer_id IS NOT NULL THEN
    UPDATE customer
    SET balance = COALESCE(balance, 0) + COALESCE(NEW.balance, 0)
    WHERE id = NEW.customer_id AND workspace_id = NEW.workspace_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_customer_balance()
  FROM PUBLIC, anon, authenticated, app_user;

DROP TRIGGER IF EXISTS trg_sync_customer_balance ON public.account_receivable;
CREATE TRIGGER trg_sync_customer_balance
  AFTER INSERT OR DELETE OR UPDATE OF balance, customer_id ON public.account_receivable
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_balance();

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_order_reference
  ON public.payment (workspace_id, order_id, reference)
  WHERE reference IS NOT NULL;

-- The payment trigger applies to every receivable of the order, so an order
-- can only have one that counts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_receivable_open_order
  ON public.account_receivable (workspace_id, order_id)
  WHERE order_id IS NOT NULL AND status <> 'written_off';

ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_idempotency_key
  ON public.payment (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.stock_ledger
  ADD CONSTRAINT ck_stock_ledger_quantity_non_negative CHECK (quantity >= 0);
ALTER TABLE public.payment
  ADD CONSTRAINT ck_payment_amount_positive CHECK (amount > 0);
ALTER TABLE public.account_receivable
  ADD CONSTRAINT ck_account_receivable_balance_non_negative CHECK (balance >= 0);

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

COMMIT;
