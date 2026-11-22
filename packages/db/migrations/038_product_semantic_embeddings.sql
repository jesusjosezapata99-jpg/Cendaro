-- Cendaro ERP — Migration 038: Multi-Tenant Product Semantic Embeddings (pgvector 1536)
-- Rollback: 038_product_semantic_embeddings.rollback.sql
--
-- Provides 1:1 cosine-normalized 1536-dim semantic vectors for workspace catalog products
-- without polluting commercial rag_documents:
-- 1. Adds UNIQUE (id, workspace_id) on public.product for compound tenant FK enforcement.
-- 2. Creates public.product_embedding with content_hash delta tracking, compound FK
--    (product_id, workspace_id) -> public.product(id, workspace_id) ON DELETE CASCADE,
--    and HNSW cosine similarity index (m = 16, ef_construction = 64).
-- 3. Enables and forces ROW LEVEL SECURITY scoped to app.workspace_id and revokes
--    all privileges from PUBLIC, anon, and authenticated.

BEGIN;

-- ── 1. Compound tenant uniqueness on product ──────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_product_id_ws'
      AND conrelid = 'public.product'::regclass
  ) THEN
    ALTER TABLE public.product
      ADD CONSTRAINT uq_product_id_ws UNIQUE (id, workspace_id);
  END IF;
END $$;

-- ── 2. Table: product_embedding ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_embedding (
  product_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id', true)::uuid) REFERENCES public.workspace(id) ON DELETE CASCADE,
  content_hash varchar(64) NOT NULL,
  search_document text NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_embedding_prod_ws_fkey
    FOREIGN KEY (product_id, workspace_id)
    REFERENCES public.product(id, workspace_id)
    ON DELETE CASCADE
);

-- ── 3. Covering & HNSW Vector Indexes ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_product_embedding_prod_ws
  ON public.product_embedding (product_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_product_embedding_workspace_id
  ON public.product_embedding (workspace_id);

CREATE INDEX IF NOT EXISTS idx_product_embedding_hnsw
  ON public.product_embedding
  USING hnsw (embedding extensions.vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ── 4. Trigger (updated_at) ───────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_updated_at_product_embedding ON public.product_embedding;
CREATE TRIGGER trg_updated_at_product_embedding
  BEFORE UPDATE ON public.product_embedding
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 5. Forced Row-Level Security & Least-Privilege Grants ─────────────────────

ALTER TABLE public.product_embedding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_embedding FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_embedding_workspace_isolation ON public.product_embedding;
CREATE POLICY product_embedding_workspace_isolation ON public.product_embedding
  AS PERMISSIVE FOR ALL TO app_user
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);

REVOKE ALL ON TABLE public.product_embedding FROM PUBLIC, anon, authenticated, app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_embedding TO app_user, service_role;

COMMIT;
