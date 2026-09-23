-- Rollback of 017_audit_log_import_idempotency_index.sql
-- Dropping the index only makes the import idempotency lookup slower; no
-- code change is needed first.

BEGIN;

DROP INDEX IF EXISTS public.idx_audit_log_import_idempotency;

COMMIT;
