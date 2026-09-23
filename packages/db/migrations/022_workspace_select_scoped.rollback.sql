-- Rollback for 022_workspace_select_scoped.sql (F9.2, finding M9).
-- Restores the baseline exactly: workspace readable by app_user without a
-- workspace filter (migration 004) and next_document_number executable by
-- PUBLIC plus the explicit anon/authenticated grants it had on 2026-09-21
-- (service_role and postgres were never revoked).

BEGIN;

ALTER POLICY workspace_app_user_select ON public.workspace
  USING (true);

GRANT EXECUTE ON FUNCTION public.next_document_number(uuid, text)
  TO PUBLIC, anon, authenticated;

COMMIT;
