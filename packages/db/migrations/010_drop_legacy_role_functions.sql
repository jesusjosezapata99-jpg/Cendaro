-- Cendaro ERP — Remove legacy global-role helpers and normalize profile roles
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F1.6 (finding C1)
--
-- 1. get_user_role(), has_role(user_role), is_admin_or_owner() and
--    is_elevated() answer "what is my role" from the GLOBAL user_profile.role,
--    which is not the source of truth (roles are per workspace in
--    workspace_member). Read-only inventory 2026-09-16: no policy, view,
--    trigger or function body references them (the has_role hits were
--    pg_catalog's pg_has_role), and EXECUTE was already revoked from PUBLIC,
--    anon and authenticated by 005. The application never calls them.
--
-- 2. user_profile.role is still shown by the UI (users.me). Align it with the
--    highest active workspace role so it cannot drift from what the server
--    enforces. Users without an active membership become 'employee'.
--    Baseline 2026-09-16: 2 profiles, both already 'owner' with an active
--    owner membership, so this statement changes 0 rows today.
--
-- Rollback: 010_drop_legacy_role_functions.rollback.sql (recreates the
-- functions; the role normalization is not reverted because it changed no
-- data at the baseline).

BEGIN;

DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.has_role(public.user_role);
DROP FUNCTION IF EXISTS public.is_admin_or_owner();
DROP FUNCTION IF EXISTS public.is_elevated();

WITH ranked AS (
  SELECT
    p.id,
    COALESCE(
      (
        SELECT m.role
        FROM public.workspace_member m
        WHERE m.user_id = p.id
          AND m.status = 'active'
        ORDER BY CASE m.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'supervisor' THEN 3
          WHEN 'employee' THEN 4
          WHEN 'vendor' THEN 5
          WHEN 'marketing' THEN 6
        END
        LIMIT 1
      ),
      'employee'::public.user_role
    ) AS effective_role
  FROM public.user_profile p
)
UPDATE public.user_profile p
SET role = ranked.effective_role
FROM ranked
WHERE ranked.id = p.id
  AND p.role IS DISTINCT FROM ranked.effective_role;

COMMIT;
