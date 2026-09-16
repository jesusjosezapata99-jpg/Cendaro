-- Cendaro ERP — Close public exposure of identity & RBAC tables
-- PLAN-2026-09-PROD-HARDENING, phase F1 (finding H1)
--
-- Audit 2026-09-15: user_profile, workspace, organization, permission and
-- role_permission had RLS disabled while anon/authenticated held every table
-- privilege (incl. TRUNCATE). With the public anon key anyone could read them
-- through PostgREST (confirmed: 2 / 1 / 1 / 102 / 301 rows) and modify them.
--
-- 1. app_user policies that preserve exactly what app_user does today inside
--    workspaceProcedure (users.byId/create/update, workspace.update,
--    workspace.inviteMember, wsPermissionProcedure). organization gets no
--    policy: the API never touches it as app_user (FK checks bypass RLS).
-- 2. Enable RLS on the 5 tables. postgres and service_role bypass RLS, so the
--    login lookup (service_role) and all non-transactional procedures
--    (postgres) are unaffected.
-- 3. Revoke every privilege from anon and authenticated on the 5 tables.
--
-- Mirrored in packages/db/src/schema.ts (pgPolicy + .enableRLS()) so that
-- drizzle-kit keeps this state. Rollback: 004_close_public_table_exposure.rollback.sql

BEGIN;

-- ── 1. app_user policies (no effect until RLS is enabled below) ─────────

CREATE POLICY user_profile_app_user_select ON public.user_profile
  AS PERMISSIVE FOR SELECT TO app_user
  USING (true);

CREATE POLICY user_profile_app_user_insert ON public.user_profile
  AS PERMISSIVE FOR INSERT TO app_user
  WITH CHECK (true);

CREATE POLICY user_profile_app_user_update ON public.user_profile
  AS PERMISSIVE FOR UPDATE TO app_user
  USING (true)
  WITH CHECK (true);

CREATE POLICY workspace_app_user_select ON public.workspace
  AS PERMISSIVE FOR SELECT TO app_user
  USING (true);

CREATE POLICY workspace_app_user_update ON public.workspace
  AS PERMISSIVE FOR UPDATE TO app_user
  USING (id = (SELECT current_setting('app.workspace_id', true)::uuid))
  WITH CHECK (id = (SELECT current_setting('app.workspace_id', true)::uuid));

CREATE POLICY permission_app_user_select ON public.permission
  AS PERMISSIVE FOR SELECT TO app_user
  USING (true);

CREATE POLICY role_permission_app_user_select ON public.role_permission
  AS PERMISSIVE FOR SELECT TO app_user
  USING (true);

-- ── 2. Enable row level security ────────────────────────────────────────

ALTER TABLE public.user_profile    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission ENABLE ROW LEVEL SECURITY;

-- ── 3. Remove all public-API access ─────────────────────────────────────

REVOKE ALL ON TABLE
  public.user_profile,
  public.workspace,
  public.organization,
  public.permission,
  public.role_permission
FROM anon, authenticated;

COMMIT;
