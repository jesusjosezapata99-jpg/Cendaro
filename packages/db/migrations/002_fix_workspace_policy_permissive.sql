-- Cendaro ERP — Fix workspace-isolation RLS policies (restrictive → permissive)
--
-- Root cause (found 2026-09-13, alongside the C1 `app_user` role-grant fix):
-- `workspacePolicy()` in packages/db/src/schema.ts creates ONE policy per
-- workspace-scoped table with `as: "restrictive"`. In Postgres, a RESTRICTIVE
-- policy only narrows rows already allowed by a PERMISSIVE policy — it never
-- grants access on its own. Since these tables have no permissive policy at
-- all, every row was unconditionally inaccessible to `app_user`, regardless
-- of `workspace_id`, independent of role privileges or the `app.workspace_id`
-- session setting. Confirmed via `pg_policy.polpermissive = false` on all
-- affected tables and a direct reproduction (an INSERT with the exact correct
-- `workspace_id` was still rejected with 42501).
--
-- This migration drops and recreates every `*_workspace_isolation` policy
-- that is currently restrictive, as permissive, with the identical name,
-- expression, role, and command scope (`FOR ALL`) — a policy's
-- permissive/restrictive flag cannot be changed with ALTER POLICY, only by
-- DROP + CREATE. Written generically (system-catalog driven) instead of one
-- statement per table to guarantee every affected table is covered exactly
-- once and stays in sync with the `workspacePolicy()` factory it mirrors.
--
-- Usage:
--   Run via Supabase SQL Editor or `psql "$DATABASE_URL" -f packages/db/migrations/002_fix_workspace_policy_permissive.sql`
--   Idempotent: re-running does nothing once all matching policies are permissive.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, p.polname AS policy_name
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.polname LIKE '%\_workspace\_isolation'
      AND p.polpermissive = false
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      pol.policy_name, pol.schema_name, pol.table_name
    );
    EXECUTE format(
      $f$CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR ALL TO app_user
         USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
         WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid)$f$,
      pol.policy_name, pol.schema_name, pol.table_name
    );
    RAISE NOTICE 'Recreated % on %.% as PERMISSIVE', pol.policy_name, pol.schema_name, pol.table_name;
  END LOOP;
END $$;
