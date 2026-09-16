-- Rollback for 004_close_public_table_exposure.sql
-- Restores the exact pre-migration state recorded in the F0.1 baseline
-- (2026-09-15): RLS disabled, no policies, and ALL privileges for anon and
-- authenticated on the 5 tables. Use ONLY if an app_user path breaks after
-- applying 004 — this re-opens the public exposure.

BEGIN;

GRANT ALL ON TABLE
  public.user_profile,
  public.workspace,
  public.organization,
  public.permission,
  public.role_permission
TO anon, authenticated;

ALTER TABLE public.user_profile    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profile_app_user_select    ON public.user_profile;
DROP POLICY IF EXISTS user_profile_app_user_insert    ON public.user_profile;
DROP POLICY IF EXISTS user_profile_app_user_update    ON public.user_profile;
DROP POLICY IF EXISTS workspace_app_user_select       ON public.workspace;
DROP POLICY IF EXISTS workspace_app_user_update       ON public.workspace;
DROP POLICY IF EXISTS permission_app_user_select      ON public.permission;
DROP POLICY IF EXISTS role_permission_app_user_select ON public.role_permission;

COMMIT;
