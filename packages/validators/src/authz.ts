/**
 * Cendaro — Server authorization matrix (PLAN-2026-09-SECURITY-REMEDIATION F2).
 *
 * Single source of truth for "which workspace role may perform which action
 * on which ERP module". Enforced server-side by `wsPermissionProcedure` /
 * `wsReadPermissionProcedure` (packages/api/src/trpc.ts); the role itself
 * always comes from `workspace_member.role` in the database. The
 * `role_permission` table is kept as an exact mirror by migration.
 *
 * Business decisions (2026-09-17):
 *   • employee   — sells (POS, orders, payments), registers customers with
 *                  their fiscal data (no credit), reads stock, no stock changes
 *   • vendor     — reads catalog/customers/orders, creates orders and quotes,
 *                  sees only their own commissions/orders/customers
 *   • marketing  — Mercado Libre listings only (view/update; catalog
 *                  read-only; importing ML orders is management)
 *   • supervisor — operations management, but container release, repricing
 *                  approval, audit and settings stay owner/admin
 *
 * `NAV_ROLE_RULES` must stay coherent with this matrix (guarded by
 * packages/api/src/__tests__/authz-matrix.test.ts).
 */
import type { UserRole } from "./index";

/** Must match the `erp_module` enum in the DB schema. */
export const ERP_MODULES = [
  "dashboard",
  "catalog",
  "inventory",
  "containers",
  "pricing",
  "rates",
  "pos",
  "orders",
  "customers",
  "vendors",
  "payments",
  "cash_closure",
  "receivables",
  "marketplace",
  "whatsapp",
  "users",
  "audit",
  "settings",
] as const;

export type ErpModule = (typeof ERP_MODULES)[number];

/** Must match the `permission_action` enum in the DB schema. */
export const PERMISSION_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "export",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

type ModulePermissions = Readonly<
  Record<PermissionAction, readonly UserRole[]>
>;

const EVERYONE = [
  "owner",
  "admin",
  "supervisor",
  "employee",
  "vendor",
  "marketing",
] as const satisfies readonly UserRole[];
const MANAGEMENT = [
  "owner",
  "admin",
  "supervisor",
] as const satisfies readonly UserRole[];
const ADMINS = ["owner", "admin"] as const satisfies readonly UserRole[];
const SALES_FLOOR = [
  "owner",
  "admin",
  "supervisor",
  "employee",
] as const satisfies readonly UserRole[];

/** Default for a management-owned module: management operates, admins delete. */
function managed(
  overrides: Partial<ModulePermissions> = {},
): ModulePermissions {
  return {
    create: MANAGEMENT,
    read: MANAGEMENT,
    update: MANAGEMENT,
    delete: ADMINS,
    approve: MANAGEMENT,
    export: MANAGEMENT,
    ...overrides,
  };
}

function adminOnly(
  overrides: Partial<ModulePermissions> = {},
): ModulePermissions {
  return {
    create: ADMINS,
    read: ADMINS,
    update: ADMINS,
    delete: ADMINS,
    approve: ADMINS,
    export: ADMINS,
    ...overrides,
  };
}

export const ROLE_PERMISSIONS: Readonly<Record<ErpModule, ModulePermissions>> =
  {
    dashboard: managed({ create: ADMINS, read: EVERYONE }),
    catalog: managed({ read: EVERYONE }),
    inventory: managed({ read: SALES_FLOOR }),
    containers: managed({ approve: ADMINS }),
    pricing: managed({ approve: ADMINS }),
    rates: managed(),
    pos: managed({
      create: SALES_FLOOR,
      read: SALES_FLOOR,
      update: SALES_FLOOR,
    }),
    orders: managed({
      create: [...SALES_FLOOR, "vendor"],
      read: [...SALES_FLOOR, "vendor"],
      update: SALES_FLOOR,
    }),
    // Counter staff register walk-in buyers with their SENIAT fiscal data;
    // granting credit (creditLimit/creditDays) still needs customers.approve.
    customers: managed({
      create: SALES_FLOOR,
      read: [...SALES_FLOOR, "vendor"],
    }),
    vendors: managed({
      create: ADMINS,
      read: [...MANAGEMENT, "vendor"],
      update: ADMINS,
    }),
    payments: managed({
      create: SALES_FLOOR,
      read: SALES_FLOOR,
      update: SALES_FLOOR,
    }),
    cash_closure: managed(),
    receivables: managed(),
    marketplace: managed({
      read: [...MANAGEMENT, "marketing"],
      update: [...MANAGEMENT, "marketing"],
    }),
    whatsapp: managed({
      create: SALES_FLOOR,
      read: SALES_FLOOR,
      update: SALES_FLOOR,
    }),
    users: adminOnly({ read: MANAGEMENT }),
    audit: adminOnly(),
    settings: adminOnly(),
  };

/**
 * Administrative modules every workspace needs whatever its plan: the
 * dashboard, member management, workspace settings and the audit trail.
 * Plan gating (workspace_module) never blocks them; quotas such as maxUsers
 * limit their use instead.
 */
export const CORE_MODULES = [
  "dashboard",
  "users",
  "settings",
  "audit",
] as const satisfies readonly ErpModule[];

export function isCoreModule(module: ErpModule): boolean {
  return (CORE_MODULES as readonly ErpModule[]).includes(module);
}

/** True when `role` may perform `action` on `module`. */
export function can(
  role: UserRole | null | undefined,
  module: ErpModule,
  action: PermissionAction,
): boolean {
  return !!role && ROLE_PERMISSIONS[module][action].includes(role);
}
