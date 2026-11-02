-- Reverts 031_monitor_role.sql.

BEGIN;

REVOKE SELECT (workspace_id, order_number) ON public.sales_order FROM monitor_reader;
REVOKE SELECT (id, workspace_id, balance) ON public.customer FROM monitor_reader;
REVOKE SELECT (customer_id, workspace_id, status, balance, paid_amount, total_amount)
  ON public.account_receivable FROM monitor_reader;
REVOKE SELECT (amount, reference, workspace_id, order_id) ON public.payment FROM monitor_reader;
REVOKE SELECT (quantity) ON public.stock_ledger FROM monitor_reader;
REVOKE USAGE ON SCHEMA public FROM monitor_reader;
DROP ROLE monitor_reader;

COMMIT;
