-- =============================================================================
-- Rollback 024: Credit Notes & WORM Audit Hash Chain
-- =============================================================================

DROP TABLE IF EXISTS public.credit_note_item;
DROP TABLE IF EXISTS public.credit_note;
DROP TYPE IF EXISTS public.credit_note_status;

DROP INDEX IF EXISTS public.idx_audit_log_workspace_created;
ALTER TABLE public.audit_log
  DROP COLUMN IF EXISTS prev_hash,
  DROP COLUMN IF EXISTS chain_hash;
