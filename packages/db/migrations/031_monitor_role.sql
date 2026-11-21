-- Cendaro ERP — Read-only role for the daily production checks.
--
-- Sees only the exact non-PII columns financial-invariants.sql needs (no names,
-- contact data, emails or fiscal IDs). Uses explicit per-table SELECT RLS policies
-- scoped to `monitor_reader` rather than `BYPASSRLS` so non-superuser `postgres`
-- on Supabase PostgreSQL 17 can create the role without privilege escalation and
-- so `monitor_reader` cannot bypass RLS on any other table. It cannot log in until
-- an operator sets its password manually outside version control.
--
-- Rollback: 031_monitor_role.rollback.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitor_reader') THEN
    CREATE ROLE monitor_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END;
$$;

GRANT monitor_reader TO postgres;
ALTER ROLE monitor_reader SET default_transaction_read_only = on;
ALTER ROLE monitor_reader SET statement_timeout = '15s';

GRANT USAGE ON SCHEMA public TO monitor_reader;
GRANT SELECT (quantity) ON public.stock_ledger TO monitor_reader;
GRANT SELECT (amount, reference, workspace_id, order_id) ON public.payment TO monitor_reader;
GRANT SELECT (customer_id, workspace_id, status, balance, paid_amount, total_amount)
  ON public.account_receivable TO monitor_reader;
GRANT SELECT (id, workspace_id, balance) ON public.customer TO monitor_reader;
GRANT SELECT (workspace_id, order_number) ON public.sales_order TO monitor_reader;

DROP POLICY IF EXISTS stock_ledger_monitor_select ON public.stock_ledger;
CREATE POLICY stock_ledger_monitor_select ON public.stock_ledger
  AS PERMISSIVE FOR SELECT TO monitor_reader
  USING (true);

DROP POLICY IF EXISTS payment_monitor_select ON public.payment;
CREATE POLICY payment_monitor_select ON public.payment
  AS PERMISSIVE FOR SELECT TO monitor_reader
  USING (true);

DROP POLICY IF EXISTS account_receivable_monitor_select ON public.account_receivable;
CREATE POLICY account_receivable_monitor_select ON public.account_receivable
  AS PERMISSIVE FOR SELECT TO monitor_reader
  USING (true);

DROP POLICY IF EXISTS customer_monitor_select ON public.customer;
CREATE POLICY customer_monitor_select ON public.customer
  AS PERMISSIVE FOR SELECT TO monitor_reader
  USING (true);

DROP POLICY IF EXISTS sales_order_monitor_select ON public.sales_order;
CREATE POLICY sales_order_monitor_select ON public.sales_order
  AS PERMISSIVE FOR SELECT TO monitor_reader
  USING (true);

COMMIT;
