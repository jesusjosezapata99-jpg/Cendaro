-- Rollback of 018_is_workspace_member_active_profile.sql
-- Restores the definition that was live before the change (read from
-- production with pg_get_functiondef on 2026-09-20): membership alone, without
-- the profile and workspace status joins.
--
-- Rolling back re-opens access for deactivated people and suspended or
-- archived workspaces, so deploy it only to unblock a real incident.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_user_id uuid, p_workspace_id uuid)
 RETURNS TABLE(member_id uuid, member_role text, member_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id, role::text, status::text
  FROM public.workspace_member
  WHERE user_id = p_user_id
    AND workspace_id = p_workspace_id
    AND status = 'active'
  LIMIT 1;
$function$;

COMMIT;
