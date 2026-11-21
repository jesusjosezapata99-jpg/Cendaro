-- Reverts 032_rag_pgvector.sql.
-- Note: USAGE ON SCHEMA extensions for app_user is intentionally preserved
-- because migration 008_pg_trgm_to_extensions.sql relies on it for similarity().

BEGIN;

DROP TRIGGER IF EXISTS trg_updated_at_rag_document_chunks ON public.rag_document_chunks;
DROP TRIGGER IF EXISTS trg_updated_at_rag_documents ON public.rag_documents;

DROP TABLE IF EXISTS public.rag_document_chunks;
DROP TABLE IF EXISTS public.rag_documents;

DROP TYPE IF EXISTS public.rag_document_status;
DROP TYPE IF EXISTS public.rag_document_type;

DROP EXTENSION IF EXISTS vector;

COMMIT;
