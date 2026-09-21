-- Cendaro ERP — Index the idempotency key of inventory imports
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F4 (F4.2 review, LOW)
--
-- inventoryImport.commit and initializeCommit look up an earlier run of the
-- same file with:
--
--   WHERE workspace_id = $1
--     AND action = $2
--     AND entity = 'inventory_import'
--     AND new_value ->> 'idempotencyKey' = $3
--
-- Without this index that lookup is a sequential scan of audit_log, which
-- only ever grows (the table is append-only by RLS). Every import takes an
-- advisory lock before the lookup, so a slow scan holds that lock and
-- serializes concurrent imports of the same warehouse for longer.
--
-- Partial on entity = 'inventory_import': import rows are a small share of
-- the audit trail, so the index stays small. Drizzle sends unnamed statements
-- (custom plans, parameter values known), so the planner can use a partial
-- index although the predicate value arrives as a parameter.
--
-- Plain CREATE INDEX (not CONCURRENTLY): audit_log is small and CONCURRENTLY
-- cannot run inside the migration transaction. Mirrored in
-- packages/db/src/schema.ts so drizzle-kit keeps it.
--
-- Rollback: 017_audit_log_import_idempotency_index.rollback.sql

BEGIN;

CREATE INDEX IF NOT EXISTS idx_audit_log_import_idempotency
  ON public.audit_log (
    workspace_id,
    action,
    ((new_value ->> 'idempotencyKey'))
  )
  WHERE entity = 'inventory_import';

COMMIT;
