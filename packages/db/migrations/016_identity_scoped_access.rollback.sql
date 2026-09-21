-- Rollback of 016_identity_scoped_access.sql
-- Restores the unscoped user_profile policies of PROD-HARDENING F1 and drops
-- the two helper functions. Deploy the code that no longer calls
-- find_active_user_id_by_email / user_membership_count first.

BEGIN;

ALTER POLICY user_profile_app_user_select ON public.user_profile
  USING (true);

ALTER POLICY user_profile_app_user_update ON public.user_profile
  USING (true)
  WITH CHECK (true);

CREATE POLICY user_profile_app_user_insert ON public.user_profile
  AS PERMISSIVE
  FOR INSERT
  TO app_user
  WITH CHECK (true);

DROP FUNCTION IF EXISTS public.find_active_user_id_by_email(text);
DROP FUNCTION IF EXISTS public.user_membership_count(uuid);

COMMIT;
