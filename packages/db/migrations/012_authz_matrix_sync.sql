-- Cendaro ERP — Mirror the server authorization matrix into role_permission
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F2 (finding C2)
--
-- GENERATED from ROLE_PERMISSIONS in packages/validators/src/authz.ts — do not
-- edit by hand; regenerate instead. The API enforces that matrix directly
-- (wsPermissionProcedure / wsReadPermissionProcedure); this table is kept as
-- an exact mirror for reporting and future admin UIs.
--
-- 1. permission rows for the new 'receivables' module (6 actions).
-- 2. role_permission diff against the 2026-09-17 baseline (301 rows):
--    granted (29):
--   customers.create employee
--   dashboard.update supervisor
--   marketplace.create supervisor
--   marketplace.read marketing
--   marketplace.update marketing
--   marketplace.update supervisor
--   orders.create vendor
--   receivables.approve admin
--   receivables.approve owner
--   receivables.approve supervisor
--   receivables.create admin
--   receivables.create owner
--   receivables.create supervisor
--   receivables.delete admin
--   receivables.delete owner
--   receivables.export admin
--   receivables.export owner
--   receivables.export supervisor
--   receivables.read admin
--   receivables.read owner
--   receivables.read supervisor
--   receivables.update admin
--   receivables.update owner
--   receivables.update supervisor
--   whatsapp.create employee
--   whatsapp.create supervisor
--   whatsapp.read employee
--   whatsapp.update employee
--   whatsapp.update supervisor
--    revoked (16):
--   audit.approve supervisor
--   audit.export supervisor
--   audit.read supervisor
--   catalog.export marketing
--   catalog.update marketing
--   containers.approve supervisor
--   customers.read marketing
--   orders.read marketing
--   pricing.approve supervisor
--   settings.approve supervisor
--   settings.export supervisor
--   settings.read supervisor
--   users.approve supervisor
--   users.export supervisor
--   vendors.create vendor
--   vendors.update vendor
-- 3. Enable 'receivables' for workspaces on plans that include payments
--    (pro/enterprise, or any workspace that already has 'payments').
-- 4. Guard: abort unless role_permission ends with exactly 314 rows.
--
-- Rollback: 012_authz_matrix_sync.rollback.sql

BEGIN;

INSERT INTO public.permission (module, action, description)
SELECT 'receivables'::public.erp_module,
       a::public.permission_action,
       'Cuentas por cobrar: ' || a
FROM unnest(ARRAY['create', 'read', 'update', 'delete', 'approve', 'export']) AS a
ON CONFLICT (module, action) DO NOTHING;

CREATE TEMP TABLE authz_desired (module text, action text, role text) ON COMMIT DROP;
INSERT INTO authz_desired (module, action, role) VALUES
  ('audit', 'approve', 'admin'),
  ('audit', 'approve', 'owner'),
  ('audit', 'create', 'admin'),
  ('audit', 'create', 'owner'),
  ('audit', 'delete', 'admin'),
  ('audit', 'delete', 'owner'),
  ('audit', 'export', 'admin'),
  ('audit', 'export', 'owner'),
  ('audit', 'read', 'admin'),
  ('audit', 'read', 'owner'),
  ('audit', 'update', 'admin'),
  ('audit', 'update', 'owner'),
  ('cash_closure', 'approve', 'admin'),
  ('cash_closure', 'approve', 'owner'),
  ('cash_closure', 'approve', 'supervisor'),
  ('cash_closure', 'create', 'admin'),
  ('cash_closure', 'create', 'owner'),
  ('cash_closure', 'create', 'supervisor'),
  ('cash_closure', 'delete', 'admin'),
  ('cash_closure', 'delete', 'owner'),
  ('cash_closure', 'export', 'admin'),
  ('cash_closure', 'export', 'owner'),
  ('cash_closure', 'export', 'supervisor'),
  ('cash_closure', 'read', 'admin'),
  ('cash_closure', 'read', 'owner'),
  ('cash_closure', 'read', 'supervisor'),
  ('cash_closure', 'update', 'admin'),
  ('cash_closure', 'update', 'owner'),
  ('cash_closure', 'update', 'supervisor'),
  ('catalog', 'approve', 'admin'),
  ('catalog', 'approve', 'owner'),
  ('catalog', 'approve', 'supervisor'),
  ('catalog', 'create', 'admin'),
  ('catalog', 'create', 'owner'),
  ('catalog', 'create', 'supervisor'),
  ('catalog', 'delete', 'admin'),
  ('catalog', 'delete', 'owner'),
  ('catalog', 'export', 'admin'),
  ('catalog', 'export', 'owner'),
  ('catalog', 'export', 'supervisor'),
  ('catalog', 'read', 'admin'),
  ('catalog', 'read', 'employee'),
  ('catalog', 'read', 'marketing'),
  ('catalog', 'read', 'owner'),
  ('catalog', 'read', 'supervisor'),
  ('catalog', 'read', 'vendor'),
  ('catalog', 'update', 'admin'),
  ('catalog', 'update', 'owner'),
  ('catalog', 'update', 'supervisor'),
  ('containers', 'approve', 'admin'),
  ('containers', 'approve', 'owner'),
  ('containers', 'create', 'admin'),
  ('containers', 'create', 'owner'),
  ('containers', 'create', 'supervisor'),
  ('containers', 'delete', 'admin'),
  ('containers', 'delete', 'owner'),
  ('containers', 'export', 'admin'),
  ('containers', 'export', 'owner'),
  ('containers', 'export', 'supervisor'),
  ('containers', 'read', 'admin'),
  ('containers', 'read', 'owner'),
  ('containers', 'read', 'supervisor'),
  ('containers', 'update', 'admin'),
  ('containers', 'update', 'owner'),
  ('containers', 'update', 'supervisor'),
  ('customers', 'approve', 'admin'),
  ('customers', 'approve', 'owner'),
  ('customers', 'approve', 'supervisor'),
  ('customers', 'create', 'admin'),
  ('customers', 'create', 'employee'),
  ('customers', 'create', 'owner'),
  ('customers', 'create', 'supervisor'),
  ('customers', 'delete', 'admin'),
  ('customers', 'delete', 'owner'),
  ('customers', 'export', 'admin'),
  ('customers', 'export', 'owner'),
  ('customers', 'export', 'supervisor'),
  ('customers', 'read', 'admin'),
  ('customers', 'read', 'employee'),
  ('customers', 'read', 'owner'),
  ('customers', 'read', 'supervisor'),
  ('customers', 'read', 'vendor'),
  ('customers', 'update', 'admin'),
  ('customers', 'update', 'owner'),
  ('customers', 'update', 'supervisor'),
  ('dashboard', 'approve', 'admin'),
  ('dashboard', 'approve', 'owner'),
  ('dashboard', 'approve', 'supervisor'),
  ('dashboard', 'create', 'admin'),
  ('dashboard', 'create', 'owner'),
  ('dashboard', 'delete', 'admin'),
  ('dashboard', 'delete', 'owner'),
  ('dashboard', 'export', 'admin'),
  ('dashboard', 'export', 'owner'),
  ('dashboard', 'export', 'supervisor'),
  ('dashboard', 'read', 'admin'),
  ('dashboard', 'read', 'employee'),
  ('dashboard', 'read', 'marketing'),
  ('dashboard', 'read', 'owner'),
  ('dashboard', 'read', 'supervisor'),
  ('dashboard', 'read', 'vendor'),
  ('dashboard', 'update', 'admin'),
  ('dashboard', 'update', 'owner'),
  ('dashboard', 'update', 'supervisor'),
  ('inventory', 'approve', 'admin'),
  ('inventory', 'approve', 'owner'),
  ('inventory', 'approve', 'supervisor'),
  ('inventory', 'create', 'admin'),
  ('inventory', 'create', 'owner'),
  ('inventory', 'create', 'supervisor'),
  ('inventory', 'delete', 'admin'),
  ('inventory', 'delete', 'owner'),
  ('inventory', 'export', 'admin'),
  ('inventory', 'export', 'owner'),
  ('inventory', 'export', 'supervisor'),
  ('inventory', 'read', 'admin'),
  ('inventory', 'read', 'employee'),
  ('inventory', 'read', 'owner'),
  ('inventory', 'read', 'supervisor'),
  ('inventory', 'update', 'admin'),
  ('inventory', 'update', 'owner'),
  ('inventory', 'update', 'supervisor'),
  ('marketplace', 'approve', 'admin'),
  ('marketplace', 'approve', 'owner'),
  ('marketplace', 'approve', 'supervisor'),
  ('marketplace', 'create', 'admin'),
  ('marketplace', 'create', 'owner'),
  ('marketplace', 'create', 'supervisor'),
  ('marketplace', 'delete', 'admin'),
  ('marketplace', 'delete', 'owner'),
  ('marketplace', 'export', 'admin'),
  ('marketplace', 'export', 'owner'),
  ('marketplace', 'export', 'supervisor'),
  ('marketplace', 'read', 'admin'),
  ('marketplace', 'read', 'marketing'),
  ('marketplace', 'read', 'owner'),
  ('marketplace', 'read', 'supervisor'),
  ('marketplace', 'update', 'admin'),
  ('marketplace', 'update', 'marketing'),
  ('marketplace', 'update', 'owner'),
  ('marketplace', 'update', 'supervisor'),
  ('orders', 'approve', 'admin'),
  ('orders', 'approve', 'owner'),
  ('orders', 'approve', 'supervisor'),
  ('orders', 'create', 'admin'),
  ('orders', 'create', 'employee'),
  ('orders', 'create', 'owner'),
  ('orders', 'create', 'supervisor'),
  ('orders', 'create', 'vendor'),
  ('orders', 'delete', 'admin'),
  ('orders', 'delete', 'owner'),
  ('orders', 'export', 'admin'),
  ('orders', 'export', 'owner'),
  ('orders', 'export', 'supervisor'),
  ('orders', 'read', 'admin'),
  ('orders', 'read', 'employee'),
  ('orders', 'read', 'owner'),
  ('orders', 'read', 'supervisor'),
  ('orders', 'read', 'vendor'),
  ('orders', 'update', 'admin'),
  ('orders', 'update', 'employee'),
  ('orders', 'update', 'owner'),
  ('orders', 'update', 'supervisor'),
  ('payments', 'approve', 'admin'),
  ('payments', 'approve', 'owner'),
  ('payments', 'approve', 'supervisor'),
  ('payments', 'create', 'admin'),
  ('payments', 'create', 'employee'),
  ('payments', 'create', 'owner'),
  ('payments', 'create', 'supervisor'),
  ('payments', 'delete', 'admin'),
  ('payments', 'delete', 'owner'),
  ('payments', 'export', 'admin'),
  ('payments', 'export', 'owner'),
  ('payments', 'export', 'supervisor'),
  ('payments', 'read', 'admin'),
  ('payments', 'read', 'employee'),
  ('payments', 'read', 'owner'),
  ('payments', 'read', 'supervisor'),
  ('payments', 'update', 'admin'),
  ('payments', 'update', 'employee'),
  ('payments', 'update', 'owner'),
  ('payments', 'update', 'supervisor'),
  ('pos', 'approve', 'admin'),
  ('pos', 'approve', 'owner'),
  ('pos', 'approve', 'supervisor'),
  ('pos', 'create', 'admin'),
  ('pos', 'create', 'employee'),
  ('pos', 'create', 'owner'),
  ('pos', 'create', 'supervisor'),
  ('pos', 'delete', 'admin'),
  ('pos', 'delete', 'owner'),
  ('pos', 'export', 'admin'),
  ('pos', 'export', 'owner'),
  ('pos', 'export', 'supervisor'),
  ('pos', 'read', 'admin'),
  ('pos', 'read', 'employee'),
  ('pos', 'read', 'owner'),
  ('pos', 'read', 'supervisor'),
  ('pos', 'update', 'admin'),
  ('pos', 'update', 'employee'),
  ('pos', 'update', 'owner'),
  ('pos', 'update', 'supervisor'),
  ('pricing', 'approve', 'admin'),
  ('pricing', 'approve', 'owner'),
  ('pricing', 'create', 'admin'),
  ('pricing', 'create', 'owner'),
  ('pricing', 'create', 'supervisor'),
  ('pricing', 'delete', 'admin'),
  ('pricing', 'delete', 'owner'),
  ('pricing', 'export', 'admin'),
  ('pricing', 'export', 'owner'),
  ('pricing', 'export', 'supervisor'),
  ('pricing', 'read', 'admin'),
  ('pricing', 'read', 'owner'),
  ('pricing', 'read', 'supervisor'),
  ('pricing', 'update', 'admin'),
  ('pricing', 'update', 'owner'),
  ('pricing', 'update', 'supervisor'),
  ('rates', 'approve', 'admin'),
  ('rates', 'approve', 'owner'),
  ('rates', 'approve', 'supervisor'),
  ('rates', 'create', 'admin'),
  ('rates', 'create', 'owner'),
  ('rates', 'create', 'supervisor'),
  ('rates', 'delete', 'admin'),
  ('rates', 'delete', 'owner'),
  ('rates', 'export', 'admin'),
  ('rates', 'export', 'owner'),
  ('rates', 'export', 'supervisor'),
  ('rates', 'read', 'admin'),
  ('rates', 'read', 'owner'),
  ('rates', 'read', 'supervisor'),
  ('rates', 'update', 'admin'),
  ('rates', 'update', 'owner'),
  ('rates', 'update', 'supervisor'),
  ('receivables', 'approve', 'admin'),
  ('receivables', 'approve', 'owner'),
  ('receivables', 'approve', 'supervisor'),
  ('receivables', 'create', 'admin'),
  ('receivables', 'create', 'owner'),
  ('receivables', 'create', 'supervisor'),
  ('receivables', 'delete', 'admin'),
  ('receivables', 'delete', 'owner'),
  ('receivables', 'export', 'admin'),
  ('receivables', 'export', 'owner'),
  ('receivables', 'export', 'supervisor'),
  ('receivables', 'read', 'admin'),
  ('receivables', 'read', 'owner'),
  ('receivables', 'read', 'supervisor'),
  ('receivables', 'update', 'admin'),
  ('receivables', 'update', 'owner'),
  ('receivables', 'update', 'supervisor'),
  ('settings', 'approve', 'admin'),
  ('settings', 'approve', 'owner'),
  ('settings', 'create', 'admin'),
  ('settings', 'create', 'owner'),
  ('settings', 'delete', 'admin'),
  ('settings', 'delete', 'owner'),
  ('settings', 'export', 'admin'),
  ('settings', 'export', 'owner'),
  ('settings', 'read', 'admin'),
  ('settings', 'read', 'owner'),
  ('settings', 'update', 'admin'),
  ('settings', 'update', 'owner'),
  ('users', 'approve', 'admin'),
  ('users', 'approve', 'owner'),
  ('users', 'create', 'admin'),
  ('users', 'create', 'owner'),
  ('users', 'delete', 'admin'),
  ('users', 'delete', 'owner'),
  ('users', 'export', 'admin'),
  ('users', 'export', 'owner'),
  ('users', 'read', 'admin'),
  ('users', 'read', 'owner'),
  ('users', 'read', 'supervisor'),
  ('users', 'update', 'admin'),
  ('users', 'update', 'owner'),
  ('vendors', 'approve', 'admin'),
  ('vendors', 'approve', 'owner'),
  ('vendors', 'approve', 'supervisor'),
  ('vendors', 'create', 'admin'),
  ('vendors', 'create', 'owner'),
  ('vendors', 'delete', 'admin'),
  ('vendors', 'delete', 'owner'),
  ('vendors', 'export', 'admin'),
  ('vendors', 'export', 'owner'),
  ('vendors', 'export', 'supervisor'),
  ('vendors', 'read', 'admin'),
  ('vendors', 'read', 'owner'),
  ('vendors', 'read', 'supervisor'),
  ('vendors', 'read', 'vendor'),
  ('vendors', 'update', 'admin'),
  ('vendors', 'update', 'owner'),
  ('whatsapp', 'approve', 'admin'),
  ('whatsapp', 'approve', 'owner'),
  ('whatsapp', 'approve', 'supervisor'),
  ('whatsapp', 'create', 'admin'),
  ('whatsapp', 'create', 'employee'),
  ('whatsapp', 'create', 'owner'),
  ('whatsapp', 'create', 'supervisor'),
  ('whatsapp', 'delete', 'admin'),
  ('whatsapp', 'delete', 'owner'),
  ('whatsapp', 'export', 'admin'),
  ('whatsapp', 'export', 'owner'),
  ('whatsapp', 'export', 'supervisor'),
  ('whatsapp', 'read', 'admin'),
  ('whatsapp', 'read', 'employee'),
  ('whatsapp', 'read', 'owner'),
  ('whatsapp', 'read', 'supervisor'),
  ('whatsapp', 'update', 'admin'),
  ('whatsapp', 'update', 'employee'),
  ('whatsapp', 'update', 'owner'),
  ('whatsapp', 'update', 'supervisor');

DELETE FROM public.role_permission rp
USING public.permission p
WHERE rp.permission_id = p.id
  AND NOT EXISTS (
    SELECT 1 FROM authz_desired d
    WHERE d.module = p.module::text
      AND d.action = p.action::text
      AND d.role = rp.role::text
  );

INSERT INTO public.role_permission (role, permission_id)
SELECT d.role::public.user_role, p.id
FROM authz_desired d
JOIN public.permission p
  ON p.module::text = d.module AND p.action::text = d.action
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.workspace_module (workspace_id, module)
SELECT w.id, 'receivables'::public.erp_module
FROM public.workspace w
WHERE w.plan IN ('pro', 'enterprise')
   OR EXISTS (
     SELECT 1 FROM public.workspace_module wm
     WHERE wm.workspace_id = w.id AND wm.module = 'payments'
   )
ON CONFLICT (workspace_id, module) DO NOTHING;

DO $$
DECLARE
  actual integer;
BEGIN
  SELECT count(*) INTO actual FROM public.role_permission;
  IF actual <> 314 THEN
    RAISE EXCEPTION 'role_permission has % rows, expected 314', actual;
  END IF;
END $$;

COMMIT;
