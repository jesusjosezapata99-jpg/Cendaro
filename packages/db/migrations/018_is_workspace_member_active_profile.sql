-- Cendaro ERP — Effective revocation in is_workspace_member
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F5 (finding H5)
--
-- Every authenticated procedure resolves the caller through
-- is_workspace_member(user, workspace). It only checked
-- workspace_member.status = 'active', so two global states were ignored:
--
--   1. user_profile.status = 'inactive' | 'suspended' — the person was
--      deactivated, but each workspace membership stayed 'active', so their
--      open session kept working everywhere.
--   2. workspace.status = 'suspended' | 'archived' — the workspace itself was
--      closed (unpaid, archived), yet its members kept writing to it.
--
-- The joins below make both states deny access at the single point every
-- procedure already goes through, instead of relying on each call site.
--
-- Kept from the original: STABLE, SECURITY DEFINER (it reads workspace_member,
-- which app_user cannot read unscoped), the pinned search_path, and the same
-- return shape (member_id, member_role, member_status).
--
-- Privileges: CREATE OR REPLACE keeps the existing grants, but they are
-- restated so this migration is complete on its own (and so the
-- migration-function-privileges guard can verify it). Production grants read
-- on 2026-09-20: EXECUTE only for postgres and service_role — app_user never
-- calls it, because membership is resolved before SET LOCAL ROLE.
--
-- Deploy order: this migration is safe on its own and can be applied before
-- the F5 code. A member whose profile or workspace is not active starts
-- getting FORBIDDEN immediately — which is the point of the fix.
--
-- Rollback: 018_is_workspace_member_active_profile.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_user_id uuid, p_workspace_id uuid)
 RETURNS TABLE(member_id uuid, member_role text, member_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT m.id, m.role::text, m.status::text
  FROM public.workspace_member m
  JOIN public.user_profile p
    ON p.id = m.user_id
   AND p.status = 'active'
  JOIN public.workspace w
    ON w.id = m.workspace_id
   AND w.status = 'active'
  WHERE m.user_id = p_user_id
    AND m.workspace_id = p_workspace_id
    AND m.status = 'active'
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid)
  TO postgres, service_role;

COMMIT;
