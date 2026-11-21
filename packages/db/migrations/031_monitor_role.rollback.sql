-- Reverts 031_monitor_role.sql.

BEGIN;

DROP POLICY IF EXISTS sales_order_monitor_select ON public.sales_order;
DROP POLICY IF EXISTS customer_monitor_select ON public.customer;
DROP POLICY IF EXISTS account_receivable_monitor_select ON public.account_receivable;
DROP POLICY IF EXISTS payment_monitor_select ON public.payment;
DROP POLICY IF EXISTS stock_ledger_monitor_select ON public.stock_ledger;

REVOKE SELECT (workspace_id, order_number) ON public.sales_order FROM monitor_reader;
REVOKE SELECT (id, workspace_id, balance) ON public.customer FROM monitor_reader;
REVOKE SELECT (customer_id, workspace_id, status, balance, paid_amount, total_amount)
  ON public.account_receivable FROM monitor_reader;
REVOKE SELECT (amount, reference, workspace_id, order_id) ON public.payment FROM monitor_reader;
REVOKE SELECT (quantity) ON public.stock_ledger FROM monitor_reader;
REVOKE USAGE ON SCHEMA public FROM monitor_reader;
REVOKE monitor_reader FROM postgres;
DROP ROLE monitor_reader;

COMMIT;
