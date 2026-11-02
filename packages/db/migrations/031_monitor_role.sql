-- Cendaro ERP — Read-only role for the daily production checks.
--
-- It sees the catalog and only the columns financial-invariants.sql needs: no
-- names, contact data or fiscal IDs. BYPASSRLS because those checks span every
-- workspace; the column grants are what limit it. It cannot log in until someone
-- sets its password by hand, which never lives in this repository.
--
-- Rollback: 031_monitor_role.rollback.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitor_reader') THEN
    CREATE ROLE monitor_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO monitor_reader;
GRANT SELECT (quantity) ON public.stock_ledger TO monitor_reader;
GRANT SELECT (amount, reference, workspace_id, order_id) ON public.payment TO monitor_reader;
GRANT SELECT (customer_id, workspace_id, status, balance, paid_amount, total_amount)
  ON public.account_receivable TO monitor_reader;
GRANT SELECT (id, workspace_id, balance) ON public.customer TO monitor_reader;
GRANT SELECT (workspace_id, order_number) ON public.sales_order TO monitor_reader;

COMMIT;
