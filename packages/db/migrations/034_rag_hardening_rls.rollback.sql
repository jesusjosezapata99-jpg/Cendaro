-- Cendaro ERP — Rollback for 034_rag_hardening_rls.sql
--
-- Reverses:
-- 1. Drops public.match_rag_chunks stored function.
-- 2. Drops composite FK on rag_document_chunks and restores single-column FK.
-- 3. Drops covering index idx_rag_document_chunks_doc_ws.
-- 4. Drops UNIQUE constraint on rag_documents(id, workspace_id).
-- 5. Restores original workspace_id column defaults.

BEGIN;

-- ── 1. Drop Stored Function ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.match_rag_chunks(uuid, extensions.vector, float8, int, text, text, uuid);
DROP FUNCTION IF EXISTS public.match_rag_chunks(uuid, extensions.vector, float8, int, text, text);

-- ── 2. Revert Compound Foreign Key ────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_rag_document_chunks_doc_ws;

ALTER TABLE public.rag_document_chunks
  DROP CONSTRAINT IF EXISTS rag_document_chunks_doc_ws_fkey;

ALTER TABLE public.rag_document_chunks
  ADD CONSTRAINT rag_document_chunks_document_id_fkey
    FOREIGN KEY (document_id)
    REFERENCES public.rag_documents(id)
    ON DELETE CASCADE;

-- ── 3. Drop Unique Constraint ─────────────────────────────────────────────────

ALTER TABLE public.rag_documents
  DROP CONSTRAINT IF EXISTS uq_rag_documents_id_ws;

-- ── 4. Revert Workspace ID Column Defaults ────────────────────────────────────

ALTER TABLE public.rag_documents
  ALTER COLUMN workspace_id SET DEFAULT (current_setting('app.workspace_id')::uuid);

ALTER TABLE public.rag_document_chunks
  ALTER COLUMN workspace_id SET DEFAULT (current_setting('app.workspace_id')::uuid);

COMMIT;
