-- Cendaro ERP — Milestone 2: RAG Database Schema (pgvector)
-- Rollback: 032_rag_pgvector.rollback.sql
--
-- Enables pgvector in schema extensions (per Supabase security advisor rule 0014),
-- creates rag_documents and rag_document_chunks tables with workspace multi-tenancy RLS,
-- HNSW vector cosine similarity indexing, updated_at triggers, and strict least-privilege
-- grants (revoking PUBLIC, anon, and authenticated default privileges).

BEGIN;

-- ── 1. Enable pgvector extension in schema extensions ─────────────────────────

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO app_user, service_role;

-- ── 2. Create RAG document enums ──────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rag_document_type') THEN
    CREATE TYPE public.rag_document_type AS ENUM (
      'packing_list',
      'commercial_invoice',
      'fiscal_invoice',
      'delivery_note'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rag_document_status') THEN
    CREATE TYPE public.rag_document_status AS ENUM (
      'pending',
      'processing',
      'indexed',
      'failed'
    );
  END IF;
END $$;

-- ── 3. Table: rag_documents ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id')::uuid) REFERENCES public.workspace(id),
  document_type public.rag_document_type NOT NULL,
  document_number varchar(64),
  title varchar(256) NOT NULL,
  file_url text,
  file_name varchar(256),
  status public.rag_document_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  token_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES public.user_profile(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable & force RLS and workspace isolation policy
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_documents FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rag_documents'
      AND policyname = 'rag_documents_workspace_isolation'
  ) THEN
    CREATE POLICY rag_documents_workspace_isolation ON public.rag_documents
      AS PERMISSIVE FOR ALL TO app_user
      USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
      WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
  END IF;
END $$;

-- ── 4. Table: rag_document_chunks ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rag_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id')::uuid) REFERENCES public.workspace(id),
  chunk_index integer NOT NULL,
  chunk_type varchar(64) NOT NULL DEFAULT 'document_summary',
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  token_count integer,
  embedding extensions.vector(1536) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable & force RLS and workspace isolation policy
ALTER TABLE public.rag_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_document_chunks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rag_document_chunks'
      AND policyname = 'rag_document_chunks_workspace_isolation'
  ) THEN
    CREATE POLICY rag_document_chunks_workspace_isolation ON public.rag_document_chunks
      AS PERMISSIVE FOR ALL TO app_user
      USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
      WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
  END IF;
END $$;

-- ── 5. Triggers (updated_at) ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_updated_at_rag_documents ON public.rag_documents;
CREATE TRIGGER trg_updated_at_rag_documents
  BEFORE UPDATE ON public.rag_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_rag_document_chunks ON public.rag_document_chunks;
CREATE TRIGGER trg_updated_at_rag_document_chunks
  BEFORE UPDATE ON public.rag_document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 6. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rag_documents_workspace_id ON public.rag_documents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_type ON public.rag_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON public.rag_documents (status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_by ON public.rag_documents (created_by);

CREATE INDEX IF NOT EXISTS idx_rag_document_chunks_workspace_id ON public.rag_document_chunks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_rag_document_chunks_document_id ON public.rag_document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_rag_document_chunks_metadata ON public.rag_document_chunks USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_rag_document_chunks_embedding ON public.rag_document_chunks
  USING hnsw (embedding extensions.vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ── 7. Least-Privilege Permissions ────────────────────────────────────────────
-- Supabase default privileges in schema public grant ALL to anon/authenticated
-- on newly created tables unless explicitly revoked.

REVOKE ALL ON TABLE public.rag_documents, public.rag_document_chunks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rag_documents, public.rag_document_chunks FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rag_documents, public.rag_document_chunks TO app_user, service_role;

COMMIT;
