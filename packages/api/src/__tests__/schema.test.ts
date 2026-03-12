/**
 * Cendaro — API Unit Tests: Schema Validation
 *
 * Validates that all schema tables, enums, and relations are properly exported
 * and structurally correct without requiring a database connection.
 */
import { describe, expect, it } from "vitest";

import * as schema from "@cendaro/db/schema";

// ─── Phase 1: Identity, RBAC, Audit ───────────

describe("Phase 1 — Identity, RBAC, Audit", () => {
  it("exports UserProfile table", () => {
    expect(schema.UserProfile).toBeDefined();
  });

  it("exports Organization table", () => {
    expect(schema.Organization).toBeDefined();
  });

  it("exports Permission table", () => {
    expect(schema.Permission).toBeDefined();
  });

  it("exports AuditLog table", () => {
    expect(schema.AuditLog).toBeDefined();
  });

  it("exports RolePermission table", () => {
    expect(schema.RolePermission).toBeDefined();
  });

  it("exports userRoleEnum with correct values", () => {
    expect(schema.userRoleEnum.enumValues).toEqual(
      expect.arrayContaining([
        "owner",
        "admin",
        "supervisor",
        "employee",
        "vendor",
      ]),
    );
  });
});

// ─── Phase 2: Catalog ─────────────────────────

describe("Phase 2 — Catálogo", () => {
  it("exports Product table", () => {
    expect(schema.Product).toBeDefined();
  });

  it("exports Category table", () => {
    expect(schema.Category).toBeDefined();
  });

  it("exports Brand table", () => {
    expect(schema.Brand).toBeDefined();
  });

  it("exports productStatusEnum with correct values", () => {
    expect(schema.productStatusEnum.enumValues).toContain("active");
    expect(schema.productStatusEnum.enumValues).toContain("draft");
  });
});

// ─── Phase 3: Inventory ───────────────────────

describe("Phase 3 — Inventario", () => {
  it("exports Warehouse table", () => {
    expect(schema.Warehouse).toBeDefined();
  });

  it("exports StockLedger table", () => {
    expect(schema.StockLedger).toBeDefined();
  });

  it("exports Container table", () => {
    expect(schema.Container).toBeDefined();
  });

  it("exports containerStatusEnum", () => {
    expect(schema.containerStatusEnum.enumValues).toEqual(
      expect.arrayContaining(["created", "in_transit", "received", "closed"]),
    );
  });
});

// ─── Phase 4: Pricing ─────────────────────────

describe("Phase 4 — Pricing", () => {
  it("exports ExchangeRate table", () => {
    expect(schema.ExchangeRate).toBeDefined();
  });

  it("exports PriceHistory table", () => {
    expect(schema.PriceHistory).toBeDefined();
  });

  it("exports RepricingEvent table", () => {
    expect(schema.RepricingEvent).toBeDefined();
  });
});

// ─── Phase 5: Sales & Payments ────────────────

describe("Phase 5 — Ventas y Pagos", () => {
  it("exports Customer table", () => {
    expect(schema.Customer).toBeDefined();
  });

  it("exports SalesOrder table", () => {
    expect(schema.SalesOrder).toBeDefined();
  });

  it("exports Payment table", () => {
    expect(schema.Payment).toBeDefined();
  });

  it("exports CashClosure table", () => {
    expect(schema.CashClosure).toBeDefined();
  });

  it("exports orderStatusEnum with 10 statuses", () => {
    expect(schema.orderStatusEnum.enumValues).toHaveLength(10);
  });

  it("exports paymentMethodEnum with 5 methods", () => {
    expect(schema.paymentMethodEnum.enumValues).toHaveLength(5);
  });
});

// ─── Phase 6: Vendors & AR ────────────────────

describe("Phase 6 — Vendedores y CxC", () => {
  it("exports VendorCommission table", () => {
    expect(schema.VendorCommission).toBeDefined();
  });

  it("exports AccountReceivable table", () => {
    expect(schema.AccountReceivable).toBeDefined();
  });

  it("exports arStatusEnum", () => {
    expect(schema.arStatusEnum.enumValues).toEqual(
      expect.arrayContaining(["pending", "partial", "paid", "overdue"]),
    );
  });
});

// ─── Phase 7: Integrations ────────────────────

describe("Phase 7 — Integraciones", () => {
  it("exports MlListing table", () => {
    expect(schema.MlListing).toBeDefined();
  });

  it("exports MlOrder table", () => {
    expect(schema.MlOrder).toBeDefined();
  });

  it("exports IntegrationLog table", () => {
    expect(schema.IntegrationLog).toBeDefined();
  });

  it("exports mlListingStatusEnum", () => {
    expect(schema.mlListingStatusEnum.enumValues).toContain("active");
    expect(schema.mlListingStatusEnum.enumValues).toContain("out_of_stock");
  });
});

// ─── Phase 8: Dashboard & Alerts ──────────────

describe("Phase 8 — Dashboard y Alertas", () => {
  it("exports SystemAlert table", () => {
    expect(schema.SystemAlert).toBeDefined();
  });

  it("exports alertTypeEnum with 8 types", () => {
    expect(schema.alertTypeEnum.enumValues).toHaveLength(8);
    expect(schema.alertTypeEnum.enumValues).toEqual(
      expect.arrayContaining([
        "low_stock",
        "inventory_diff",
        "product_blocked",
        "rate_change",
        "vendor_under_target",
        "order_late",
        "ml_failure",
        "ar_overdue",
      ]),
    );
  });
});

// ─── Cross-Phase: Relations ───────────────────

describe("Relations", () => {
  it("exports userProfileRelations", () => {
    expect(schema.userProfileRelations).toBeDefined();
  });

  it("exports salesOrderRelations", () => {
    expect(schema.salesOrderRelations).toBeDefined();
  });

  it("exports vendorCommissionRelations", () => {
    expect(schema.vendorCommissionRelations).toBeDefined();
  });

  it("exports mlListingRelations", () => {
    expect(schema.mlListingRelations).toBeDefined();
  });
});
