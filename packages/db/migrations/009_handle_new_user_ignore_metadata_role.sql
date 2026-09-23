-- Cendaro ERP — handle_new_user must not trust a user-supplied role
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F1.5 (finding C1)
--
-- The on_auth_user_created trigger copied raw_user_meta_data->>'role' into
-- user_profile.role. raw_user_meta_data is whatever the caller sends in
-- auth.signUp({ options: { data } }) or auth.updateUser({ data }), so anyone
-- able to create an account could start as 'owner'. New profiles now always
-- start as 'employee'; the real role is assigned by /api/auth/create-user
-- (service role) and, per workspace, by workspace_member.role.
--
-- Everything else is identical to the previous definition (display name and
-- username defaults, SECURITY DEFINER, empty search_path).
--
-- Rollback: 009_handle_new_user_ignore_metadata_role.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.user_profile (
    id,
    email,
    full_name,
    username,
    role,
    status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    'employee'::public.user_role,
    'active'::public.user_status
  );
  RETURN NEW;
END;
$function$;

-- CREATE OR REPLACE keeps existing privileges; restate the 005 posture.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

COMMIT;
