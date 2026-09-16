-- Rollback of 005_least_privilege_public_api.sql
-- Restores the exact pre-F3 privileges recorded in the 2026-09-15 baseline.
-- The 5 identity/RBAC tables stay closed: their revoke belongs to 004.
-- Note: GRANT ... ON ALL TABLES also covers tables created after F3.

BEGIN;

-- ── 2. Future objects (reverse order) ───────────────────────────────────

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;

-- ── 1. Existing objects ─────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION
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
TO PUBLIC, anon, authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;

-- Keep 004 in force.
REVOKE ALL ON TABLE
  public.user_profile,
  public.workspace,
  public.organization,
  public.permission,
  public.role_permission
FROM anon, authenticated;

COMMIT;
