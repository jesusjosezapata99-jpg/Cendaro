-- Cendaro ERP — Scope identity access to the current workspace
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F3 (findings H1, H2, M7)
--
-- user_profile is one global row per person, shared by every workspace they
-- belong to. Until now app_user (the role the API switches to inside
-- workspaceProcedure) could SELECT and UPDATE any profile (USING true) and
-- INSERT profiles, so a code path that forgot its workspace filter would
-- expose or change people of other companies.
--
-- 1. user_profile_app_user_insert is dropped: accounts are created only by
--    /api/auth/create-user with the service role (users.create was removed
--    in F1), so app_user has no insert path.
-- 2. SELECT is limited to profiles of active or suspended members of the
--    workspace bound to the transaction (app.workspace_id); UPDATE to active
--    members. A pending invitation or a removed membership is not a
--    relationship: otherwise inviting someone (without their consent) or
--    having removed them would keep their shared profile readable and
--    writable. The workspace_member subquery is itself under its workspace
--    isolation policy.
-- 3. find_active_user_id_by_email(text): workspace.inviteMember must find
--    accounts that are not members yet, which the scoped policy hides. The
--    SECURITY DEFINER function returns only the id of an active account.
-- 4. user_membership_count(uuid): users.update refuses to change name/phone
--    of someone who also belongs to other workspaces, which app_user cannot
--    see (workspace_member is workspace-isolated). Counts only active and
--    suspended memberships, so an invitation from an unrelated workspace
--    cannot block the person's own workspace.
--
-- Both functions follow 005: EXECUTE revoked from PUBLIC, anon and
-- authenticated; granted to app_user only. Empty search_path, schema-qualified.
--
-- Pre-check (read-only, 2026-09-17): 2 profiles, both active members of the
-- only workspace; app_user holds table-level grants on user_profile and
-- workspace_member; no other API path reads user_profile as app_user.
--
-- Deploy order: apply, then deploy the F3 code right away — the previous
-- inviteMember reads user_profile by email as app_user and cannot find
-- non-members under the scoped policy.
-- Rollback: 016_identity_scoped_access.rollback.sql

BEGIN;

DROP POLICY IF EXISTS user_profile_app_user_insert ON public.user_profile;

ALTER POLICY user_profile_app_user_select ON public.user_profile
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_member m
      WHERE m.user_id = user_profile.id
        AND m.workspace_id = (select current_setting('app.workspace_id', true))::uuid
        AND m.status IN ('active', 'suspended')
    )
  );

ALTER POLICY user_profile_app_user_update ON public.user_profile
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_member m
      WHERE m.user_id = user_profile.id
        AND m.workspace_id = (select current_setting('app.workspace_id', true))::uuid
        AND m.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_member m
      WHERE m.user_id = user_profile.id
        AND m.workspace_id = (select current_setting('app.workspace_id', true))::uuid
        AND m.status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION public.find_active_user_id_by_email(p_email text)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT p.id
  FROM public.user_profile p
  WHERE lower(p.email) = lower(btrim(p_email))
    AND p.status = 'active'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.user_membership_count(p_user_id uuid)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT count(*)::integer
  FROM public.workspace_member m
  WHERE m.user_id = p_user_id
    AND m.status IN ('active', 'suspended');
$function$;

REVOKE EXECUTE ON FUNCTION
  public.find_active_user_id_by_email(text),
  public.user_membership_count(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.find_active_user_id_by_email(text),
  public.user_membership_count(uuid)
TO app_user;

COMMIT;
