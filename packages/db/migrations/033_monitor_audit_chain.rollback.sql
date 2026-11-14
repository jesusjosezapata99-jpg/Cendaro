-- Rollback for 033_monitor_audit_chain.sql

BEGIN;

DROP FUNCTION IF EXISTS public.verify_audit_chain_integrity();

DROP POLICY IF EXISTS audit_log_monitor_select ON public.audit_log;

REVOKE SELECT (id, workspace_id, seq, prev_hash, chain_hash, created_at)
  ON public.audit_log FROM monitor_reader;

COMMIT;
