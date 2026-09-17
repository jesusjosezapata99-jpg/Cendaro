/**
 * Procedure authorization coverage (PLAN-2026-09-SECURITY-REMEDIATION F2, C2).
 *
 * 1. Every procedure exposed by appRouter declares `meta.authz`, and the
 *    declaration matches the reviewed table below. Adding an endpoint, or
 *    changing what gates one, fails here until the table is updated on purpose.
 * 2. The permission builders really enforce role + plan module, before input
 *    parsing, using the role from workspace_member (never user metadata).
 */
import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import { appRouter } from "../root";
import {
  createCallerFactory,
  createTRPCRouter,
  memberReadProcedure,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";

/** "module.action" for permission procedures, otherwise the authz kind. */
const EXPECTED_AUTHZ: Record<string, string> = {
  "users.list": "users.read",
  "users.me": "self",
  "users.byId": "users.read",
  "users.update": "users.update",
  "users.uiPreferences": "self",
  "users.updateUiPreferences": "self",
  "users.mfaStatus": "member",
  "users.exportMyData": "self",
  "users.anonymizeMyData": "self",
  "audit.list": "audit.read",
  "audit.byId": "audit.read",
  "approvals.listPending": "dashboard.read",
  "approvals.list": "dashboard.read",
  "approvals.byId": "dashboard.read",
  "approvals.request": "dashboard.update",
  "approvals.approve": "dashboard.approve",
  "approvals.reject": "dashboard.approve",
  "catalog.listProducts": "catalog.read",
  "catalog.productById": "catalog.read",
  "catalog.createProduct": "catalog.create",
  "catalog.updateProduct": "catalog.update",
  "catalog.listBrands": "catalog.read",
  "catalog.createBrand": "catalog.create",
  "catalog.listCategories": "catalog.read",
  "catalog.createCategory": "catalog.create",
  "catalog.listSuppliers": "catalog.read",
  "catalog.createSupplier": "catalog.create",
  "catalog.setPrice": "pricing.update",
  "catalog.setAttributes": "catalog.update",
  "catalogImport.create": "catalog.create",
  "catalogImport.validate": "catalog.create",
  "catalogImport.resolveCategories": "catalog.create",
  "catalogImport.dryRun": "catalog.create",
  "catalogImport.commit": "catalog.create",
  "catalogImport.getSession": "catalog.create",
  "inventory.listWarehouses": "inventory.read",
  "inventory.createWarehouse": "inventory.create",
  "inventory.stockOverview": "inventory.read",
  "inventory.channelSummary": "inventory.read",
  "inventory.stockByProduct": "inventory.read",
  "inventory.transferStock": "inventory.update",
  "inventory.toggleLock": "inventory.update",
  "inventory.listMovements": "inventory.read",
  "inventory.getWarehouseDetail": "inventory.read",
  "inventory.warehouseStock": "inventory.read",
  "inventory.updateStockQuantity": "inventory.update",
  "inventory.listCounts": "inventory.read",
  "inventory.createCount": "inventory.update",
  "inventory.approveCount": "inventory.approve",
  "inventory.listCountItems": "inventory.read",
  "inventory.addCountItems": "inventory.update",
  "inventory.submitCountItem": "inventory.update",
  "inventory.finalizeCount": "inventory.approve",
  "inventoryImport.getWarehouseProducts": "inventory.update",
  "inventoryImport.commit": "inventory.update",
  "inventoryImport.initializeCommit": "inventory.update",
  "container.list": "containers.read",
  "container.byId": "containers.read",
  "container.create": "containers.create",
  "container.updateStatus": "containers.update",
  "container.addItems": "containers.update",
  "container.getAIPromptConfig": "containers.read",
  "container.updateAIPromptConfig": "settings.update",
  "container.getCatalogSnapshot": "containers.read",
  "container.confirmWithMatching": "containers.update",
  "container.saveCorrection": "containers.update",
  "container.getPackingListItems": "containers.read",
  "pricing.latestRates": "member",
  "pricing.rateHistory": "rates.read",
  "pricing.setRate": "rates.update",
  "pricing.convert": "member",
  "pricing.priceHistory": "pricing.read",
  "pricing.listRepricingEvents": "pricing.read",
  "pricing.approveRepricing": "pricing.approve",
  "quotes.list": "orders.read",
  "quotes.byId": "orders.read",
  "quotes.create": "orders.create",
  "quotes.updateStatus": "orders.update",
  "quotes.convertToOrder": "orders.create",
  "sales.listCustomers": "customers.read",
  "sales.customerById": "customers.read",
  "sales.createCustomer": "customers.create",
  "sales.updateCustomer": "customers.update",
  "sales.customerStats": "customers.read",
  "sales.listOrders": "orders.read",
  "sales.orderById": "orders.read",
  "sales.createOrder": "orders.create",
  "sales.updateOrderStatus": "orders.update",
  "sales.checkoutPos": "pos.create",
  "sales.listPayments": "payments.read",
  "sales.addPayment": "payments.create",
  "sales.validatePayment": "payments.approve",
  "sales.listClosures": "cash_closure.read",
  "sales.createClosure": "cash_closure.create",
  "sales.reviewClosure": "cash_closure.approve",
  "payments.list": "payments.read",
  "payments.add": "payments.create",
  "payments.validate": "payments.approve",
  "payments.listClosures": "cash_closure.read",
  "payments.createClosure": "cash_closure.create",
  "payments.reviewClosure": "cash_closure.approve",
  "receivables.list": "receivables.read",
  "receivables.byId": "receivables.read",
  "receivables.createInstallments": "receivables.create",
  "receivables.markPaid": "receivables.approve",
  "receivables.summary": "receivables.read",
  "reporting.salesSummary": "dashboard.export",
  "reporting.salesByChannel": "dashboard.export",
  "reporting.paymentMethods": "dashboard.export",
  "reporting.inventoryValuation": "dashboard.export",
  "reporting.topProducts": "dashboard.export",
  "reporting.reconcileFinancialLedger": "dashboard.export",
  "vendor.myCommissions": "vendors.read",
  "vendor.myOrders": "vendors.read",
  "vendor.myCustomers": "vendors.read",
  "vendor.allCommissions": "vendors.approve",
  "vendor.payCommission": "vendors.approve",
  "vendor.listAR": "receivables.read",
  "vendor.arById": "receivables.read",
  "vendor.overdueAR": "receivables.read",
  "vendor.createAR": "receivables.create",
  "vendor.recordPayment": "receivables.update",
  "integrations.listMlListings": "marketplace.read",
  "integrations.syncMlListing": "marketplace.update",
  "integrations.listMlOrders": "marketplace.read",
  "integrations.importMlOrder": "marketplace.create",
  "integrations.listLogs": "marketplace.read",
  "integrations.unresolvedAlerts": "marketplace.read",
  "integrations.resolveLog": "marketplace.update",
  "dashboard.overview": "dashboard.read",
  "dashboard.salesSummary": "dashboard.export",
  "dashboard.latestClosures": "cash_closure.read",
  "dashboard.listAlerts": "dashboard.read",
  "dashboard.activeAlertCount": "dashboard.read",
  "dashboard.dismissAlert": "dashboard.update",
  "dashboard.dismissAllByType": "dashboard.update",
  "search.global": "dashboard.read",
  "health.ping": "public",
  "workspace.list": "self",
  "workspace.current": "member",
  "workspace.create": "self",
  "workspace.update": "settings.update",
  "workspace.members": "users.read",
  "workspace.inviteMember": "users.create",
  "workspace.removeMember": "users.delete",
};

interface AuthzMeta {
  kind: string;
  module?: string;
  action?: string;
}

function declaredAuthz(): Record<string, string> {
  const declared: Record<string, string> = {};
  for (const [path, procedure] of Object.entries(appRouter._def.procedures)) {
    const authz = (
      procedure as unknown as { _def: { meta?: { authz?: AuthzMeta } } }
    )._def.meta?.authz;
    declared[path] = !authz
      ? "MISSING"
      : authz.kind === "permission"
        ? `${authz.module}.${authz.action}`
        : authz.kind;
  }
  return declared;
}

describe("appRouter authorization coverage", () => {
  const declared = declaredAuthz();

  it("every procedure declares meta.authz", () => {
    const missing = Object.entries(declared)
      .filter(([, authz]) => authz === "MISSING")
      .map(([path]) => path);
    expect(missing).toEqual([]);
  });

  it("matches the reviewed authorization table exactly", () => {
    expect(declared).toEqual(EXPECTED_AUTHZ);
  });

  it("only health checks are public", () => {
    const publicPaths = Object.entries(declared)
      .filter(([, authz]) => authz === "public")
      .map(([path]) => path);
    expect(publicPaths).toEqual(["health.ping"]);
  });
});

// ── Enforcement ────────────────────────────────────────────────────

let idCounter = 0;

/** Fresh ids keep the process-wide membership and module caches out of the way. */
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function fakeDb(opts: { role: string; moduleEnabled: boolean }) {
  const select = (shape: Record<string, unknown>) => {
    const rows =
      "plan" in shape
        ? [{ plan: "pro" }]
        : "fullName" in shape
          ? [{ fullName: "Caller" }]
          : opts.moduleEnabled
            ? [{ id: "module-row" }]
            : [];
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(rows),
    };
    return chain;
  };

  const tx = { execute: () => Promise.resolve({ rows: [] }), select };

  return {
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: nextId(),
            member_role: opts.role,
            member_status: "active",
          },
        ],
      }),
    select,
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
}

function contextFor(role: string, moduleEnabled = true) {
  return {
    // No role in the token: authorization must come from workspace_member.
    user: { id: nextId(), email: "caller@example.com" },
    db: fakeDb({ role, moduleEnabled }) as never,
    requestId: "req-authz",
    log: logger.child({ requestId: "req-authz" }),
    workspaceId: nextId(),
  };
}

const testRouter = createTRPCRouter({
  createOrder: wsPermissionProcedure("orders", "create").mutation(() => "ok"),
  transferStock: wsPermissionProcedure("inventory", "update").mutation(
    () => "ok",
  ),
  readStock: wsReadPermissionProcedure("inventory", "read").query(() => "ok"),
  readReceivables: wsReadPermissionProcedure("receivables", "read").query(
    () => "ok",
  ),
  updateSettings: wsPermissionProcedure("settings", "update").mutation(
    () => "ok",
  ),
  latestRates: memberReadProcedure.query(() => "ok"),
});
const createTestCaller = createCallerFactory(testRouter);
const createAppCaller = createCallerFactory(appRouter);

const denied = (permission: string) =>
  expect.objectContaining({
    code: "FORBIDDEN",
    message: `Permiso denegado: ${permission}`,
  }) as Error;

describe("permission builders enforce the matrix", () => {
  it("rejects an employee changing stock", async () => {
    const caller = createTestCaller(contextFor("employee"));
    await expect(caller.transferStock()).rejects.toThrowError(
      denied("inventory.update"),
    );
  });

  it("lets an employee read stock", async () => {
    const caller = createTestCaller(contextFor("employee"));
    await expect(caller.readStock()).resolves.toBe("ok");
  });

  it("lets a vendor create orders", async () => {
    const caller = createTestCaller(contextFor("vendor"));
    await expect(caller.createOrder()).resolves.toBe("ok");
  });

  it("rejects a vendor reading workspace receivables", async () => {
    const caller = createTestCaller(contextFor("vendor"));
    await expect(caller.readReceivables()).rejects.toThrowError(
      denied("receivables.read"),
    );
  });

  it("lets every member read member procedures", async () => {
    const caller = createTestCaller(contextFor("marketing"));
    await expect(caller.latestRates()).resolves.toBe("ok");
  });

  it("rejects a permitted role when the plan lacks the module", async () => {
    const caller = createTestCaller(contextFor("owner", false));
    await expect(caller.readReceivables()).rejects.toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: 'Módulo "receivables" no habilitado en este workspace',
      }) as Error,
    );
  });

  it("never plan-gates core modules", async () => {
    // A starter workspace has no settings row, but its owner must still
    // administer it.
    const caller = createTestCaller(contextFor("owner", false));
    await expect(caller.updateSettings()).resolves.toBe("ok");
  });

  it("still role-gates core modules", async () => {
    const caller = createTestCaller(contextFor("supervisor", false));
    await expect(caller.updateSettings()).rejects.toThrowError(
      denied("settings.update"),
    );
  });

  it("does not plan-gate member procedures", async () => {
    const caller = createTestCaller(contextFor("vendor", false));
    await expect(caller.latestRates()).resolves.toBe("ok");
  });

  it("rejects an unauthenticated caller on self procedures", async () => {
    const caller = createAppCaller({ ...contextFor("owner"), user: null });
    await expect(caller.users.me()).rejects.toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Error,
    );
  });

  it("checks the role before touching the module table", async () => {
    // Module disabled AND role denied: the role error must win, so a caller
    // cannot probe which modules a workspace has enabled.
    const caller = createTestCaller(contextFor("employee", false));
    await expect(caller.transferStock()).rejects.toThrowError(
      denied("inventory.update"),
    );
  });
});

describe("real routers are gated before input parsing", () => {
  it("rejects marketing listing sales orders", async () => {
    const caller = createAppCaller(contextFor("marketing"));
    await expect(caller.sales.listOrders(undefined as never)).rejects.toThrow(
      denied("orders.read"),
    );
  });

  it("rejects an employee transferring stock", async () => {
    const caller = createAppCaller(contextFor("employee"));
    await expect(
      caller.inventory.transferStock(undefined as never),
    ).rejects.toThrow(denied("inventory.update"));
  });

  it("rejects a supervisor closing (releasing) a container", async () => {
    const caller = createAppCaller(contextFor("supervisor"));
    await expect(
      caller.container.updateStatus({
        id: "00000000-0000-4000-8000-00000000c0de",
        status: "closed",
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "Solo administradores pueden cerrar o liberar contenedores",
      }) as Error,
    );
  });

  it("rejects marketing changing container status at all", async () => {
    const caller = createAppCaller(contextFor("marketing"));
    await expect(
      caller.container.updateStatus(undefined as never),
    ).rejects.toThrow(denied("containers.update"));
  });

  it("rejects a supervisor approving repricing", async () => {
    const caller = createAppCaller(contextFor("supervisor"));
    await expect(
      caller.pricing.approveRepricing(undefined as never),
    ).rejects.toThrow(denied("pricing.approve"));
  });

  it("rejects a supervisor reading the audit log", async () => {
    const caller = createAppCaller(contextFor("supervisor"));
    await expect(caller.audit.list(undefined as never)).rejects.toThrow(
      denied("audit.read"),
    );
  });

  it("rejects a vendor paying commissions", async () => {
    const caller = createAppCaller(contextFor("vendor"));
    await expect(
      caller.vendor.payCommission(undefined as never),
    ).rejects.toThrow(denied("vendors.approve"));
  });
});
