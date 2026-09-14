/**
 * Cendaro — Dashboard Overview Unit Tests (T3.1)
 *
 * Covers the pure, DB-independent pieces: period → date-range mapping and
 * role redaction for `grossProfit`/`receivables`.
 *
 * NOT covered here (needs a live Postgres, which this workspace has no
 * test-DB harness for yet): the actual `overview` query results, or
 * workspace isolation of the underlying SQL. That is verified by static
 * review instead — every query in `dashboard.ts` (both the Drizzle
 * query-builder ones and the raw `sql` ones) filters explicitly on
 * `workspace_id = ctx.workspace.workspaceId`, since `workspaceReadProcedure`
 * skips RLS for read performance (same gap already documented in
 * `search.test.ts`).
 */
import { describe, expect, it } from "vitest";

import {
  canViewGrossProfit,
  canViewReceivables,
  dashboardPeriodSchema,
  periodToRange,
} from "./dashboard";

describe("periodToRange", () => {
  it("maps 7d to a 7-day window bucketed by day", () => {
    const { since, bucketUnit } = periodToRange("7d");
    const days = (Date.now() - since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect(bucketUnit).toBe("day");
  });

  it("maps 30d to a 30-day window bucketed by day", () => {
    const { since, bucketUnit } = periodToRange("30d");
    const days = (Date.now() - since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(bucketUnit).toBe("day");
  });

  it("maps 90d to a 90-day window bucketed by week", () => {
    const { since, bucketUnit } = periodToRange("90d");
    const days = (Date.now() - since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
    expect(bucketUnit).toBe("week");
  });

  it("maps 12m to a 365-day window bucketed by month", () => {
    const { since, bucketUnit } = periodToRange("12m");
    const days = (Date.now() - since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(364.9);
    expect(days).toBeLessThan(365.1);
    expect(bucketUnit).toBe("month");
  });
});

describe("dashboard.overview input schema", () => {
  it("accepts each documented period value", () => {
    for (const period of ["7d", "30d", "90d", "12m"]) {
      expect(dashboardPeriodSchema.safeParse(period).success).toBe(true);
    }
  });

  it("rejects an undocumented period value", () => {
    expect(dashboardPeriodSchema.safeParse("6m").success).toBe(false);
  });
});

describe("role redaction (employee never sees profit or receivables)", () => {
  it("allows owner/admin/supervisor to view gross profit, blocks employee", () => {
    expect(canViewGrossProfit("owner")).toBe(true);
    expect(canViewGrossProfit("admin")).toBe(true);
    expect(canViewGrossProfit("supervisor")).toBe(true);
    expect(canViewGrossProfit("employee")).toBe(false);
    expect(canViewGrossProfit(null)).toBe(false);
  });

  it("allows owner/admin/supervisor to view receivables, blocks employee", () => {
    expect(canViewReceivables("owner")).toBe(true);
    expect(canViewReceivables("admin")).toBe(true);
    expect(canViewReceivables("supervisor")).toBe(true);
    expect(canViewReceivables("employee")).toBe(false);
    expect(canViewReceivables(null)).toBe(false);
  });

  it("blocks vendor and marketing from both", () => {
    expect(canViewGrossProfit("vendor")).toBe(false);
    expect(canViewGrossProfit("marketing")).toBe(false);
    expect(canViewReceivables("vendor")).toBe(false);
    expect(canViewReceivables("marketing")).toBe(false);
  });
});
