/**
 * Authorization matrix guard (PLAN-2026-09-SECURITY-REMEDIATION F2).
 *
 * ROLE_PERMISSIONS (@cendaro/validators) is what the API enforces. These tests
 * pin it to the DB enums, to the menu rules users actually see, to the
 * business decisions of 2026-09-17, and to the generated role_permission
 * mirror (migration 012), so none of them can drift silently.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type {
  ErpModule,
  NavRoleRuleKey,
  PermissionAction,
  UserRole,
} from "@cendaro/validators";
import {
  erpModuleEnum,
  permissionActionEnum,
  userRoleEnum,
} from "@cendaro/db/schema";
import {
  can,
  ERP_MODULES,
  NAV_ROLE_RULES,
  PERMISSION_ACTIONS,
  ROLE_PERMISSIONS,
  USER_ROLES,
} from "@cendaro/validators";

describe("matrix ↔ database enums", () => {
  it("ERP_MODULES matches erp_module (same values, same order)", () => {
    expect([...ERP_MODULES]).toEqual(erpModuleEnum.enumValues);
  });

  it("PERMISSION_ACTIONS matches permission_action", () => {
    expect([...PERMISSION_ACTIONS]).toEqual(permissionActionEnum.enumValues);
  });

  it("USER_ROLES matches user_role", () => {
    expect([...USER_ROLES]).toEqual(userRoleEnum.enumValues);
  });
});

describe("matrix invariants", () => {
  it("defines every module × action", () => {
    for (const module of ERP_MODULES) {
      for (const action of PERMISSION_ACTIONS) {
        expect(ROLE_PERMISSIONS[module][action]).toBeDefined();
      }
    }
  });

  it("owner holds every permission", () => {
    for (const module of ERP_MODULES) {
      for (const action of PERMISSION_ACTIONS) {
        expect(can("owner", module, action), `${module}.${action}`).toBe(true);
      }
    }
  });

  it("delete is owner/admin only everywhere", () => {
    for (const module of ERP_MODULES) {
      expect([...ROLE_PERMISSIONS[module].delete].sort()).toEqual([
        "admin",
        "owner",
      ]);
    }
  });

  it("denies a missing role", () => {
    expect(can(null, "dashboard", "read")).toBe(false);
    expect(can(undefined, "dashboard", "read")).toBe(false);
  });
});

/**
 * Each menu entry must show exactly the roles that can use the page behind it,
 * otherwise users either see links that return 403 or lose access they have.
 */
const NAV_TO_PERMISSION: Record<NavRoleRuleKey, [ErpModule, PermissionAction]> =
  {
    pos: ["pos", "read"],
    orders: ["orders", "read"],
    customers: ["customers", "read"],
    deliveryNotes: ["orders", "approve"],
    invoices: ["orders", "approve"],
    vendors: ["vendors", "approve"],
    createOrder: ["orders", "create"],
    createCustomer: ["customers", "create"],
    pricing: ["pricing", "read"],
    catalogImport: ["catalog", "create"],
    createProduct: ["catalog", "create"],
    containers: ["containers", "read"],
    inventory: ["inventory", "update"],
    payments: ["payments", "read"],
    accountsReceivable: ["receivables", "read"],
    cashClosure: ["cash_closure", "read"],
    rates: ["rates", "read"],
    marketplace: ["marketplace", "read"],
    whatsapp: ["whatsapp", "read"],
    settings: ["settings", "read"],
    users: ["users", "update"],
    audit: ["audit", "read"],
    alerts: ["dashboard", "update"],
  };

describe("matrix ↔ NAV_ROLE_RULES", () => {
  for (const [navKey, [module, action]] of Object.entries(NAV_TO_PERMISSION)) {
    it(`${navKey} menu roles equal ${module}.${action}`, () => {
      const navRoles = [...NAV_ROLE_RULES[navKey as NavRoleRuleKey]].sort();
      expect(navRoles).toEqual([...ROLE_PERMISSIONS[module][action]].sort());
    });
  }
});

describe("business decisions 2026-09-17", () => {
  const cases: [UserRole, ErpModule, PermissionAction, boolean][] = [
    // Employee: reads stock (POS), never changes it
    ["employee", "inventory", "read", true],
    ["employee", "inventory", "update", false],
    ["employee", "inventory", "create", false],
    ["employee", "orders", "create", true],
    ["employee", "payments", "create", true],
    ["employee", "customers", "create", true],
    ["employee", "customers", "approve", false],
    ["employee", "receivables", "read", false],
    // Vendor: reads, creates orders and quotes, no global receivables
    ["vendor", "orders", "create", true],
    ["vendor", "orders", "update", false],
    ["vendor", "customers", "create", false],
    ["vendor", "customers", "read", true],
    ["vendor", "catalog", "read", true],
    ["vendor", "vendors", "read", true],
    ["vendor", "vendors", "approve", false],
    ["vendor", "receivables", "read", false],
    ["vendor", "inventory", "read", false],
    // Marketing: Mercado Libre listings only
    ["marketing", "marketplace", "read", true],
    ["marketing", "marketplace", "update", true],
    ["marketing", "marketplace", "create", false],
    ["marketing", "catalog", "read", true],
    ["marketing", "catalog", "update", false],
    ["marketing", "orders", "read", false],
    ["marketing", "customers", "read", false],
    // Supervisor: no container release, repricing approval, audit or settings
    ["supervisor", "containers", "approve", false],
    ["supervisor", "containers", "update", true],
    ["supervisor", "pricing", "approve", false],
    ["supervisor", "audit", "read", false],
    ["supervisor", "settings", "read", false],
    ["supervisor", "inventory", "approve", true],
    ["supervisor", "users", "read", true],
    ["supervisor", "users", "update", false],
  ];

  for (const [role, module, action, allowed] of cases) {
    it(`${role} ${allowed ? "can" : "cannot"} ${module}.${action}`, () => {
      expect(can(role, module, action)).toBe(allowed);
    });
  }
});

describe("matrix ↔ generated role_permission mirror (migration 012)", () => {
  const sql = readFileSync(
    fileURLToPath(
      new URL(
        "../../../db/migrations/012_authz_matrix_sync.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const desiredBlock =
    /INSERT INTO authz_desired \(module, action, role\) VALUES\r?\n([\s\S]*?);/.exec(
      sql,
    )?.[1] ?? "";

  it("mirrors ROLE_PERMISSIONS exactly", () => {
    const fromSql = [
      ...desiredBlock.matchAll(/\('([a-z_]+)', '([a-z_]+)', '([a-z_]+)'\)/g),
    ]
      .map((m) => `${m[1]}.${m[2]}.${m[3]}`)
      .sort();

    const fromMatrix = ERP_MODULES.flatMap((module) =>
      PERMISSION_ACTIONS.flatMap((action) =>
        ROLE_PERMISSIONS[module][action].map(
          (role) => `${module}.${action}.${role}`,
        ),
      ),
    ).sort();

    expect(fromMatrix.length).toBeGreaterThan(0);
    expect(fromSql).toEqual(fromMatrix);
    expect(sql).toContain(`expected ${fromMatrix.length}'`);
  });
});
