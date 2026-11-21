-- Rollback for 036_rag_audit_log.sql
--
-- Note: Dropping an immutable audit table removes historical RAG audit links;
-- execute only during controlled pre-GA rehearsal or emergency rollback.

BEGIN;

DROP FUNCTION IF EXISTS public.verify_rag_audit_chain_integrity();

DROP TRIGGER IF EXISTS trg_rag_audit_log_no_truncate ON public.rag_audit_log;
DROP TRIGGER IF EXISTS trg_rag_audit_log_immutable ON public.rag_audit_log;
DROP TRIGGER IF EXISTS trg_rag_audit_log_chain ON public.rag_audit_log;

DROP FUNCTION IF EXISTS public.rag_audit_log_immutable();
DROP FUNCTION IF EXISTS public.rag_audit_log_chain();

DROP TABLE IF EXISTS public.rag_audit_log;
DROP SEQUENCE IF EXISTS public.rag_audit_log_seq;

COMMIT;
