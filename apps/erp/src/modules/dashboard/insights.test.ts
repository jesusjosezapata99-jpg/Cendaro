import { describe, expect, it } from "vitest";

import { inventoryFilterParsers } from "~/hooks/params/use-inventory-filter-params";
import { orderFilterParsers } from "~/hooks/params/use-order-filter-params";
import { buildDashboardInsights } from "./insights";

describe("T4.5 — Dashboard Ticker Insights Links & Real Filters", () => {
  it("returns empty array when overview is null or undefined", () => {
    expect(buildDashboardInsights(null)).toEqual([]);
    expect(buildDashboardInsights(undefined)).toEqual([]);
  });

  it("returns empty array when all metrics are zero / neutral", () => {
    const insights = buildDashboardInsights({
      pendingDispatch: { count: 0 },
      lowStock: { count: 0 },
      receivables: { overdueCount: 0, total: 0 },
      rate: { changePct: 0 },
    });
    expect(insights).toEqual([]);
  });

  it("links pending dispatch insight to /orders?statuses=confirmed,prepared", () => {
    const single = buildDashboardInsights({
      pendingDispatch: { count: 1 },
      lowStock: { count: 0 },
      receivables: null,
      rate: { changePct: 0 },
    });
    expect(single).toHaveLength(1);
    expect(single[0]?.text).toBe("Tienes 1 pedido por despachar");
    expect(single[0]?.href).toBe("/orders?statuses=confirmed,prepared");

    const plural = buildDashboardInsights({
      pendingDispatch: { count: 5 },
      lowStock: { count: 0 },
      receivables: null,
      rate: { changePct: 0 },
    });
    expect(plural[0]?.text).toBe("Tienes 5 pedidos por despachar");
    expect(plural[0]?.href).toBe("/orders?statuses=confirmed,prepared");

    // Verify orderFilterParsers parses this query string correctly
    const query = new URLSearchParams(plural[0]?.href.split("?")[1]);
    const parsedStatuses = orderFilterParsers.statuses.parseServerSide(
      query.get("statuses") ?? "",
    );
    expect(parsedStatuses).toEqual(["confirmed", "prepared"]);
  });

  it("links low stock insight to /inventory?status=low_stock", () => {
    const single = buildDashboardInsights({
      pendingDispatch: { count: 0 },
      lowStock: { count: 1 },
      receivables: null,
      rate: { changePct: 0 },
    });
    expect(single).toHaveLength(1);
    expect(single[0]?.text).toBe("1 producto bajo mínimo");
    expect(single[0]?.href).toBe("/inventory?status=low_stock");

    const plural = buildDashboardInsights({
      pendingDispatch: { count: 0 },
      lowStock: { count: 12 },
      receivables: null,
      rate: { changePct: 0 },
    });
    expect(plural[0]?.text).toBe("12 productos bajo mínimo");
    expect(plural[0]?.href).toBe("/inventory?status=low_stock");

    // Verify inventoryFilterParsers parses this query string correctly
    const query = new URLSearchParams(plural[0]?.href.split("?")[1]);
    const parsedStatus = inventoryFilterParsers.status.parseServerSide(
      query.get("status") ?? "",
    );
    expect(parsedStatus).toBe("low_stock");
  });

  it("links overdue receivables insight to /accounts-receivable?status=overdue", () => {
    const insights = buildDashboardInsights({
      pendingDispatch: { count: 0 },
      lowStock: { count: 0 },
      receivables: { overdueCount: 3, total: 1450.5 },
      rate: { changePct: 0 },
    });
    expect(insights).toHaveLength(1);
    expect(insights[0]?.text).toBe("CxC vencidas por $1450.50");
    expect(insights[0]?.href).toBe("/accounts-receivable?status=overdue");
  });

  it("links BCV rate change to /rates with positive and negative signs", () => {
    const positive = buildDashboardInsights({
      pendingDispatch: { count: 0 },
      lowStock: { count: 0 },
      receivables: null,
      rate: { changePct: 1.25 },
    });
    expect(positive).toHaveLength(1);
    expect(positive[0]?.text).toBe("La tasa BCV cambió +1.3% hoy");
    expect(positive[0]?.href).toBe("/rates");

    const negative = buildDashboardInsights({
      pendingDispatch: { count: 0 },
      lowStock: { count: 0 },
      receivables: null,
      rate: { changePct: -0.8 },
    });
    expect(negative).toHaveLength(1);
    expect(negative[0]?.text).toBe("La tasa BCV cambió -0.8% hoy");
    expect(negative[0]?.href).toBe("/rates");
  });

  it("generates all four insights when all triggers are active", () => {
    const insights = buildDashboardInsights({
      pendingDispatch: { count: 4 },
      lowStock: { count: 7 },
      receivables: { overdueCount: 2, total: 800 },
      rate: { changePct: 0.5 },
    });
    expect(insights).toHaveLength(4);
    expect(insights.map((i) => i.href)).toEqual([
      "/orders?statuses=confirmed,prepared",
      "/inventory?status=low_stock",
      "/accounts-receivable?status=overdue",
      "/rates",
    ]);
  });
});
