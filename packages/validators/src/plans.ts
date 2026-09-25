/**
 * Cendaro — Workspace plan defaults.
 *
 * Shared by `workspace.create` (packages/api/src/modules/workspace.ts), which
 * seeds every new workspace with them, and by the public site's plans section
 * (PLAN-2026-09-LANDING-REDESIGN T1.8), so the published limits can never
 * drift from what the server enforces.
 */
import type { ErpModule } from "./authz";

/**
 * Modules enabled on a new (starter) workspace, beyond CORE_MODULES
 * (dashboard, users, settings, audit), which every plan always has.
 * Sync with erpModuleEnum in packages/db/src/schema.ts.
 */
export const STARTER_MODULES = [
  "dashboard",
  "catalog",
  "inventory",
  "orders",
  "pos",
  "customers",
  // POS checkout records the payment (payments.create)
  "payments",
] as const satisfies readonly ErpModule[];

/** Quota row of a new (starter) workspace. A negative limit means unlimited. */
export const STARTER_QUOTA = {
  maxUsers: 1,
  maxWarehouses: 1,
  maxProducts: 500,
  maxCustomers: 50,
  maxStorageMb: 500,
} as const;
