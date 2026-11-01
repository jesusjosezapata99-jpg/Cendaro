-- Rollback for 029_audit_chain.sql

BEGIN;

GRANT UPDATE, DELETE ON public.audit_log TO app_user;

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON public.audit_log;
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
DROP FUNCTION IF EXISTS public.audit_log_immutable();

DROP TRIGGER IF EXISTS trg_audit_log_chain ON public.audit_log;
DROP FUNCTION IF EXISTS public.audit_log_chain();

DROP INDEX IF EXISTS public.idx_audit_log_workspace_created;
DROP INDEX IF EXISTS public.idx_audit_log_workspace_seq;
DROP INDEX IF EXISTS public.uq_audit_log_seq;

ALTER TABLE public.audit_log
  DROP COLUMN IF EXISTS chain_hash,
  DROP COLUMN IF EXISTS prev_hash,
  DROP COLUMN IF EXISTS seq;

COMMIT;
