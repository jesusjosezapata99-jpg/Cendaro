-- Cendaro ERP — Milestone 1: Phase 1 Double-Lock Multi-Tenant RLS & RBAC Domain Pushdown
-- Rollback: 034_rag_hardening_rls.rollback.sql
--
-- Closes V-04, V-06, V-08, V-11:
-- 1. Sets missing_ok = true in workspace_id column defaults on rag_documents and rag_document_chunks.
-- 2. Enforces compound foreign key (document_id, workspace_id) on rag_document_chunks referencing rag_documents(id, workspace_id).
-- 3. Adds UNIQUE (id, workspace_id) constraint on rag_documents.
-- 4. Creates public.match_rag_chunks SECURITY INVOKER stored function with session context assertion,
--    HNSW iterative scan parameter configuration, and SQL RBAC domain pushdown.
-- 5. Revokes execution privileges from PUBLIC and anon, granting execute only to app_user and service_role.

BEGIN;

-- ── 1. Fix workspace_id column defaults (V-06) ────────────────────────────────

ALTER TABLE public.rag_documents
  ALTER COLUMN workspace_id SET DEFAULT (current_setting('app.workspace_id', true)::uuid);

ALTER TABLE public.rag_document_chunks
  ALTER COLUMN workspace_id SET DEFAULT (current_setting('app.workspace_id', true)::uuid);

-- ── 2. Compound Multi-Tenant Foreign Key & Unique Constraint (V-11) ───────────

ALTER TABLE public.rag_documents
  DROP CONSTRAINT IF EXISTS uq_rag_documents_id_ws;

ALTER TABLE public.rag_documents
  ADD CONSTRAINT uq_rag_documents_id_ws UNIQUE (id, workspace_id);

ALTER TABLE public.rag_document_chunks
  DROP CONSTRAINT IF EXISTS rag_document_chunks_document_id_fkey,
  DROP CONSTRAINT IF EXISTS rag_document_chunks_doc_ws_fkey;

ALTER TABLE public.rag_document_chunks
  ADD CONSTRAINT rag_document_chunks_doc_ws_fkey
    FOREIGN KEY (document_id, workspace_id)
    REFERENCES public.rag_documents(id, workspace_id)
    ON DELETE CASCADE;

-- Covering composite index for foreign key performance
CREATE INDEX IF NOT EXISTS idx_rag_document_chunks_doc_ws
  ON public.rag_document_chunks (document_id, workspace_id);

-- ── 3. Guarantee FORCE ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.rag_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_document_chunks FORCE ROW LEVEL SECURITY;

-- ── 4. Stored Function: match_rag_chunks (V-04, V-08) ─────────────────────────

DROP FUNCTION IF EXISTS public.match_rag_chunks(uuid, extensions.vector, float8, int, text, text);

CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  p_workspace_id uuid,
  p_query_embedding extensions.vector,
  p_match_threshold float8,
  p_match_count int,
  p_document_type text DEFAULT NULL,
  p_user_role text DEFAULT NULL,
  p_vendor_id uuid DEFAULT NULL
) RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_index int,
  chunk_type text,
  content text,
  token_count int,
  chunk_metadata jsonb,
  document_type text,
  document_number text,
  document_title text,
  document_metadata jsonb,
  similarity float8,
  distance float8
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Session context assertion (handles both NULL and empty string after RESET)
  IF p_workspace_id IS NULL
     OR NULLIF(current_setting('app.workspace_id', true), '') IS NULL
     OR p_workspace_id IS DISTINCT FROM NULLIF(current_setting('app.workspace_id', true), '')::uuid THEN
    RAISE EXCEPTION 'Workspace session context mismatch' USING ERRCODE = '42501';
  END IF;

  -- Dynamic pgvector HNSW parameters (graceful fallback on pgvector < 0.8)
  PERFORM set_config('hnsw.ef_search', '100', true);
  BEGIN
    PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.chunk_index,
    c.chunk_type::text AS chunk_type,
    c.content,
    c.token_count,
    c.metadata AS chunk_metadata,
    d.document_type::text AS document_type,
    d.document_number::text AS document_number,
    d.title::text AS document_title,
    d.metadata AS document_metadata,
    (1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding))::float8 AS similarity,
    (c.embedding OPERATOR(extensions.<=>) p_query_embedding)::float8 AS distance
  FROM public.rag_document_chunks c
  INNER JOIN public.rag_documents d
    ON c.document_id = d.id AND c.workspace_id = d.workspace_id
  WHERE c.workspace_id = p_workspace_id
    AND (p_document_type IS NULL OR d.document_type::text = p_document_type)
    AND (
      p_user_role IS NULL
      OR p_user_role = 'owner'
      OR (
        CASE
          WHEN jsonb_typeof(c.metadata->'allowed_roles') = 'array' AND jsonb_array_length(c.metadata->'allowed_roles') > 0
            THEN (c.metadata->'allowed_roles') ? p_user_role
          WHEN jsonb_typeof(c.metadata->'accessRoles') = 'array' AND jsonb_array_length(c.metadata->'accessRoles') > 0
            THEN (c.metadata->'accessRoles') ? p_user_role
          WHEN jsonb_typeof(c.metadata #> '{accessRules,allowedRoles}') = 'array' AND jsonb_array_length(c.metadata #> '{accessRules,allowedRoles}') > 0
            THEN (c.metadata #> '{accessRules,allowedRoles}') ? p_user_role
          WHEN jsonb_typeof(d.metadata #> '{accessRules,allowedRoles}') = 'array' AND jsonb_array_length(d.metadata #> '{accessRules,allowedRoles}') > 0
            THEN (d.metadata #> '{accessRules,allowedRoles}') ? p_user_role
          WHEN jsonb_typeof(d.metadata->'accessRoles') = 'array' AND jsonb_array_length(d.metadata->'accessRoles') > 0
            THEN (d.metadata->'accessRoles') ? p_user_role
          WHEN jsonb_typeof(d.metadata->'allowed_roles') = 'array' AND jsonb_array_length(d.metadata->'allowed_roles') > 0
            THEN (d.metadata->'allowed_roles') ? p_user_role
          ELSE p_user_role <> 'vendor'
        END
      )
    )
    AND (
      CASE
        WHEN p_user_role = 'vendor' THEN
          CASE
            WHEN NULLIF(COALESCE(
              c.metadata->>'vendorId',
              c.metadata #>> '{queryRestrictions,vendorId}',
              d.metadata->>'vendorId',
              d.metadata #>> '{queryRestrictions,vendorId}'
            ), '') IS NOT NULL THEN
              p_vendor_id IS NOT NULL
              AND NULLIF(COALESCE(
                c.metadata->>'vendorId',
                c.metadata #>> '{queryRestrictions,vendorId}',
                d.metadata->>'vendorId',
                d.metadata #>> '{queryRestrictions,vendorId}'
              ), '') = p_vendor_id::text
            ELSE
              (
                (jsonb_typeof(c.metadata->'allowed_roles') = 'array' AND (c.metadata->'allowed_roles') ? 'vendor')
                OR (jsonb_typeof(c.metadata->'accessRoles') = 'array' AND (c.metadata->'accessRoles') ? 'vendor')
                OR (jsonb_typeof(c.metadata #> '{accessRules,allowedRoles}') = 'array' AND (c.metadata #> '{accessRules,allowedRoles}') ? 'vendor')
                OR (jsonb_typeof(d.metadata #> '{accessRules,allowedRoles}') = 'array' AND (d.metadata #> '{accessRules,allowedRoles}') ? 'vendor')
                OR (jsonb_typeof(d.metadata->'accessRoles') = 'array' AND (d.metadata->'accessRoles') ? 'vendor')
                OR (jsonb_typeof(d.metadata->'allowed_roles') = 'array' AND (d.metadata->'allowed_roles') ? 'vendor')
              )
          END
        WHEN NULLIF(COALESCE(
          c.metadata->>'vendorId',
          c.metadata #>> '{queryRestrictions,vendorId}',
          d.metadata->>'vendorId',
          d.metadata #>> '{queryRestrictions,vendorId}'
        ), '') IS NOT NULL THEN
          (p_user_role IS NULL OR p_user_role IN ('owner', 'admin', 'supervisor'))
          AND (
            p_vendor_id IS NULL
            OR NULLIF(COALESCE(
              c.metadata->>'vendorId',
              c.metadata #>> '{queryRestrictions,vendorId}',
              d.metadata->>'vendorId',
              d.metadata #>> '{queryRestrictions,vendorId}'
            ), '') = p_vendor_id::text
          )
        ELSE
          p_vendor_id IS NULL
      END
    )
    AND (1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding)) >= p_match_threshold
  ORDER BY c.embedding OPERATOR(extensions.<=>) p_query_embedding ASC
  LIMIT p_match_count;
END;
$$;

-- ── 5. Privilege Hardening ────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.match_rag_chunks(uuid, extensions.vector, float8, int, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks(uuid, extensions.vector, float8, int, text, text, uuid) TO app_user, service_role;

COMMIT;
