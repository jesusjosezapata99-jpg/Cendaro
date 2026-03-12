/**
 * Cendaro — API Unit Tests: Router Structure
 *
 * Validates that all routers are properly structured and exported.
 */
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";

describe("appRouter", () => {
  it("is defined and has the correct shape", () => {
    expect(appRouter).toBeDefined();
    expect(appRouter._def).toBeDefined();
    expect(appRouter._def.procedures).toBeDefined();
  });

  it("contains all expected sub-routers", () => {
    const procedures = appRouter._def.procedures;

    // Phase 1
    expect(procedures).toHaveProperty("users.me");
    expect(procedures).toHaveProperty("audit.list");

    // Phase 2
    expect(procedures).toHaveProperty("catalog.listProducts");
    expect(procedures).toHaveProperty("catalog.createProduct");

    // Phase 3
    expect(procedures).toHaveProperty("inventory.stockByProduct");
    expect(procedures).toHaveProperty("inventory.getWarehouseDetail");
    expect(procedures).toHaveProperty("inventory.warehouseStock");
    expect(procedures).toHaveProperty("inventory.updateStockQuantity");
    expect(procedures).toHaveProperty("inventory.listCountItems");
    expect(procedures).toHaveProperty("inventory.addCountItems");
    expect(procedures).toHaveProperty("inventory.submitCountItem");
    expect(procedures).toHaveProperty("inventory.finalizeCount");
    expect(procedures).toHaveProperty("container.list");

    // Phase 4
    expect(procedures).toHaveProperty("pricing.latestRates");

    // Phase 5
    expect(procedures).toHaveProperty("sales.listOrders");
    expect(procedures).toHaveProperty("sales.createOrder");
    expect(procedures).toHaveProperty("sales.createClosure");

    // Phase 6
    expect(procedures).toHaveProperty("vendor.myCommissions");
    expect(procedures).toHaveProperty("vendor.listAR");

    // Phase 7
    expect(procedures).toHaveProperty("integrations.listMlListings");
    expect(procedures).toHaveProperty("integrations.syncMlListing");

    // Phase 8
    expect(procedures).toHaveProperty("dashboard.salesSummary");
    expect(procedures).toHaveProperty("dashboard.listAlerts");
    expect(procedures).toHaveProperty("dashboard.dismissAlert");

    // Phase 9 — Approvals
    expect(procedures).toHaveProperty("approvals.list");

    // Sprint 2 — Quotes
    expect(procedures).toHaveProperty("quotes.list");

    // Payments
    expect(procedures).toHaveProperty("payments.list");

    // Receivables
    expect(procedures).toHaveProperty("receivables.list");

    // Reporting
    expect(procedures).toHaveProperty("reporting.salesSummary");

    // Health
    expect(procedures).toHaveProperty("health.ping");
  });

  it("has the correct number of top-level routers", () => {
    // 16 routers: users, audit, approvals, catalog, inventory, container, pricing, quotes, sales, payments, receivables, reporting, vendor, integrations, dashboard, health
    const topLevel = new Set<string>();
    for (const key of Object.keys(appRouter._def.procedures)) {
      const router = key.split(".")[0];
      if (router) topLevel.add(router);
    }
    expect(topLevel.size).toBe(16);
  });
});
