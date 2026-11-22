-- Cendaro ERP — Migration 037: Multi-Tenant Zero-Template Import Profiles
-- Rollback: 037_import_template_profiles.rollback.sql
--
-- Stores learned column mappings and unit/currency transformation rules per
-- (workspace_id, target_domain, header_fingerprint) so recurring supplier spreadsheets
-- resolve in 0ms with 0 LLM tokens while enforcing strict workspace isolation:
-- 1. Adds UNIQUE (id, workspace_id) on public.supplier for compound tenant FK safety.
-- 2. Creates public.import_template_profile with compound FK (supplier_id, workspace_id),
--    covering indexes for every FK, updated_at trigger, and FORCE ROW LEVEL SECURITY.
-- 3. Revokes all privileges from PUBLIC, anon, and authenticated.

BEGIN;

-- ── 1. Compound tenant uniqueness on supplier (prevents cross-tenant supplier binding) ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_supplier_id_ws'
      AND conrelid = 'public.supplier'::regclass
  ) THEN
    ALTER TABLE public.supplier
      ADD CONSTRAINT uq_supplier_id_ws UNIQUE (id, workspace_id);
  END IF;
END $$;

-- ── 2. Table: import_template_profile ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.import_template_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id', true)::uuid) REFERENCES public.workspace(id) ON DELETE CASCADE,
  supplier_id uuid,
  target_domain varchar(32) NOT NULL CHECK (target_domain IN ('catalog', 'inventory', 'packing_list')),
  profile_name varchar(128) NOT NULL,
  header_fingerprint varchar(64) NOT NULL,
  sample_headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  transform_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  hit_count integer NOT NULL DEFAULT 1 CHECK (hit_count >= 0),
  created_by uuid REFERENCES public.user_profile(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_template_profile_supplier_ws_fkey
    FOREIGN KEY (supplier_id, workspace_id)
    REFERENCES public.supplier(id, workspace_id)
    ON DELETE SET NULL (supplier_id),
  CONSTRAINT uq_import_template_profile_fingerprint
    UNIQUE (workspace_id, target_domain, header_fingerprint)
);

-- ── 3. Covering Indexes (fk-index-coverage invariant) ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_import_template_profile_workspace_id
  ON public.import_template_profile (workspace_id);

CREATE INDEX IF NOT EXISTS idx_import_template_profile_supplier_ws
  ON public.import_template_profile (supplier_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_import_template_profile_created_by
  ON public.import_template_profile (created_by);

-- ── 4. Trigger (updated_at) ───────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_updated_at_import_template_profile ON public.import_template_profile;
CREATE TRIGGER trg_updated_at_import_template_profile
  BEFORE UPDATE ON public.import_template_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 5. Forced Row-Level Security & Least-Privilege Grants ─────────────────────

ALTER TABLE public.import_template_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_template_profile FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_template_profile_workspace_isolation ON public.import_template_profile;
CREATE POLICY import_template_profile_workspace_isolation ON public.import_template_profile
  AS PERMISSIVE FOR ALL TO app_user
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);

REVOKE ALL ON TABLE public.import_template_profile FROM PUBLIC, anon, authenticated, app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.import_template_profile TO app_user, service_role;

COMMIT;
