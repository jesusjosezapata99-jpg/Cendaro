-- Rollback of 010_drop_legacy_role_functions.sql
-- Recreates the 4 legacy helpers with their exact pre-F1 definitions and the
-- 005 privilege posture (no EXECUTE for PUBLIC, anon, authenticated).
-- The user_profile.role normalization is not reverted: it changed 0 rows at
-- the 2026-09-16 baseline.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS public.user_role
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_profile WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.has_role(required_role public.user_role)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profile
    WHERE id = auth.uid() AND role = required_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profile
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_elevated()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profile
    WHERE id = auth.uid() AND role IN ('owner', 'admin', 'supervisor')
  );
$function$;

REVOKE EXECUTE ON FUNCTION
  public.get_user_role(),
  public.has_role(public.user_role),
  public.is_admin_or_owner(),
  public.is_elevated()
FROM PUBLIC, anon, authenticated;

COMMIT;
