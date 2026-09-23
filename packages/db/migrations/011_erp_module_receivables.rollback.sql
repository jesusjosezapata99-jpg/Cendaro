-- Rollback of 011_erp_module_receivables.sql
-- Postgres has no ALTER TYPE ... DROP VALUE. Apply
-- 012_authz_matrix_sync.rollback.sql first: it deletes every permission and
-- workspace_module row that uses 'receivables', after which the enum value is
-- unused and harmless. Removing it would require recreating public.erp_module
-- and every column that uses it, which is not worth the risk.
SELECT 1;
