-- Rollback of 009_handle_new_user_ignore_metadata_role.sql
-- Restores the exact pre-F1 definition (reads the role from
-- raw_user_meta_data). WARNING: this reintroduces finding C1.

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
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.user_role,
      'employee'::public.user_role
    ),
    'active'::public.user_status
  );
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

COMMIT;
