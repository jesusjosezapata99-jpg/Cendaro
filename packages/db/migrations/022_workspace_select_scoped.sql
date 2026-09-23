-- Cendaro ERP — Scope workspace SELECT for app_user to the current workspace
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F9.2 (finding M9)
--
-- F9.2 runs every tRPC read as app_user under RLS so that a query that forgets
-- its workspace_id filter still cannot see another tenant. A production catalog
-- audit (2026-09-21, read-only) found the one tenant table where that promise
-- was empty: `workspace_app_user_select` is USING (true), so any app_user
-- transaction — read or write — could list every workspace on the platform
-- (name, slug, plan, status, organization_id).
--
-- The policy was written by migration 004 to "preserve what app_user does
-- today"; it is not needed any more. Every code path that legitimately lists
-- workspaces across tenants (workspace.list / invitations / acceptInvite /
-- declineInvite / create, users.exportMyData, the rate-sync cron) runs on the
-- pooled `postgres` connection (selfProcedure or getDb()), which bypasses RLS.
-- Under app_user the only workspace ever read or updated is the one bound to
-- the transaction. No other policy references the workspace table (checked in
-- pg_policies), foreign-key checks bypass RLS, and the SECURITY DEFINER
-- triggers (enforce_workspace_quota) run as their owner.
--
-- Also: public.next_document_number(uuid, text) kept the default EXECUTE grant
-- to PUBLIC, so anon and authenticated (the PostgREST roles) could call it.
-- They hold no table privileges, so it fails safe today, but a function that
-- writes document_sequence should be callable only by the role that uses it.
-- Same pattern as migration 005: revoke from PUBLIC/anon/authenticated, grant
-- to app_user explicitly.
--
-- Classification: 🔴 CRITICAL (RLS policy change + function privileges) —
-- double approval before production. Validated first on a disposable Supabase
-- branch with the read-procedure smoke suite and the workspace-RLS
-- integration suite.
-- Rollback: 022_workspace_select_scoped.rollback.sql

BEGIN;

ALTER POLICY workspace_app_user_select ON public.workspace
  USING (id = (select current_setting('app.workspace_id', true))::uuid);

REVOKE EXECUTE ON FUNCTION public.next_document_number(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.next_document_number(uuid, text)
  TO app_user;

COMMIT;
