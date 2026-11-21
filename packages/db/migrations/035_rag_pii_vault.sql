-- Cendaro ERP — Milestone 2: Phase 2 Cryptographic PII Vault & Pre-Embedding Tokenization
-- Rollback: 035_rag_pii_vault.rollback.sql
--
-- Features 11–16 (Closes V-13):
-- 1. Creates public.rag_pii_vault table for AES-256-GCM encrypted PII entities.
-- 2. Enforces composite foreign key (document_id, workspace_id) referencing public.rag_documents(id, workspace_id).
-- 3. Enforces unique constraint on (workspace_id, document_id, surrogate_token).
-- 4. Creates covering index idx_rag_pii_vault_doc_ws on (document_id, workspace_id).
-- 5. Enables and forces ROW LEVEL SECURITY with workspace isolation policy.
-- 6. Revokes all privileges from PUBLIC and anon, granting execute/CRUD to app_user and service_role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rag_pii_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id', true)::uuid) REFERENCES public.workspace(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,
  surrogate_token varchar(128) NOT NULL,
  entity_type varchar(32) NOT NULL,
  encrypted_value bytea NOT NULL,
  key_fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rag_pii_vault_doc_ws_fkey
    FOREIGN KEY (document_id, workspace_id)
    REFERENCES public.rag_documents(id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_rag_pii_vault_token
    UNIQUE (workspace_id, document_id, surrogate_token)
);

CREATE INDEX IF NOT EXISTS idx_rag_pii_vault_doc_ws
  ON public.rag_pii_vault (document_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_rag_pii_vault_workspace_id
  ON public.rag_pii_vault (workspace_id);

ALTER TABLE public.rag_pii_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_pii_vault FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_pii_vault_workspace_isolation ON public.rag_pii_vault;
CREATE POLICY rag_pii_vault_workspace_isolation ON public.rag_pii_vault
  AS PERMISSIVE FOR ALL TO app_user
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);

REVOKE ALL ON TABLE public.rag_pii_vault FROM PUBLIC, anon, authenticated, app_user;
GRANT SELECT, INSERT, DELETE ON TABLE public.rag_pii_vault TO app_user, service_role;

COMMIT;
