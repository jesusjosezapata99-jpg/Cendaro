-- Cendaro ERP — Least privilege for the public Data API roles
-- PLAN-2026-09-PROD-HARDENING, phase F3 (findings H3, H4)
--
-- Baseline 2026-09-15 (read-only inventory):
--   * anon and authenticated held every privilege (arwdDxtm, incl. TRUNCATE)
--     on the other 62 public tables. RLS limited the rows, not the surface
--     (advisor lints 0026/0027: 62 + 62 tables visible in GraphQL).
--   * The 13 SECURITY DEFINER functions were executable by PUBLIC, anon and
--     authenticated, i.e. callable through POST /rest/v1/rpc/<name>
--     (lints 0028/0029: 13 + 13).
--   * postgres default privileges in public re-granted all of the above to
--     every new table, sequence and function.
--
-- Nothing in the app uses these roles. The API connects as postgres and
-- switches to app_user, which has its own explicit grants, is NOINHERIT and
-- is not a member of anon/authenticated. The only supabase-js table access
-- uses service_role. No policy, column default, CHECK, view or SECURITY
-- INVOKER body calls the 13 functions, and is_workspace_member() is called
-- as postgres (its owner). Trigger functions: EXECUTE is checked by
-- CREATE TRIGGER, not when the trigger fires (F3.2 dry run, see report).
--
-- Deliberately unchanged:
--   * pg_trgm functions — never ALL FUNCTIONS: app_user needs similarity().
--   * PUBLIC EXECUTE on future functions. Per-schema default privileges can
--     only add to the global default, and a global revoke would also strip
--     app_user from future functions. Every new SECURITY DEFINER function
--     must REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated explicitly.
--   * supabase_admin default privileges (not alterable as postgres).
--
-- Rollback: 005_least_privilege_public_api.rollback.sql

BEGIN;

-- ── 1. Existing objects ─────────────────────────────────────────────────

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.apply_stock_movement(),
  public.enforce_workspace_quota(),
  public.generate_order_number(),
  public.get_user_role(),
  public.handle_new_user(),
  public.has_role(public.user_role),
  public.is_admin_or_owner(),
  public.is_elevated(),
  public.is_workspace_member(uuid, uuid),
  public.record_price_change(),
  public.rls_auto_enable(),
  public.update_ar_on_payment(),
  public.validate_stock_quantity()
FROM PUBLIC, anon, authenticated;

-- ── 2. Future objects created by postgres in public ─────────────────────

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;
