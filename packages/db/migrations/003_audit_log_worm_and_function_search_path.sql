-- Cendaro ERP — WORM Audit Trail & Function Search Path Hardening
--
-- 1. WORM (Write-Once, Read-Many) immutability on audit_log for SOC 1 (ICFR),
--    SOC 2 Type II, and ISO/IEC 27001 compliance.
--    Replaces the previous ALL-commands policy with separate SELECT and INSERT
--    policies for app_user. UPDATE and DELETE are default-denied by RLS.
--
-- 2. Hardens mutable search_path on security-definer / helper functions
--    to eliminate schema injection vulnerabilities (Supabase lint 0011).

BEGIN;

-- ── 1. Audit Log WORM Policy ──────────────────────────────────────────

DROP POLICY IF EXISTS audit_log_workspace_isolation ON public.audit_log;

CREATE POLICY audit_log_workspace_select ON public.audit_log
  AS PERMISSIVE FOR SELECT TO app_user
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY audit_log_workspace_insert ON public.audit_log
  AS PERMISSIVE FOR INSERT TO app_user
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);

-- ── 2. Function Search Path Hardening ───────────────────────────────────

ALTER FUNCTION public.enforce_workspace_quota()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_workspace_member(uuid, uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.next_document_number(uuid, text)
  SET search_path = public, pg_temp;

COMMIT;
