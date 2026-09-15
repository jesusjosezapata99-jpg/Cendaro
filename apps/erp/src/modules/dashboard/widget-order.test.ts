import { describe, expect, it } from "vitest";

import type { WidgetId } from "@cendaro/validators";

import {
  DEFAULT_WIDGET_ORDER,
  resolveAllowedWidgets,
  resolveWidgetOrder,
  toggleWidgetHidden,
  WIDGET_TITLES,
} from "./widget-order";

describe("widget-order utilities", () => {
  it("DEFAULT_WIDGET_ORDER contains all 8 expected widget ids", () => {
    expect(DEFAULT_WIDGET_ORDER).toHaveLength(8);
    expect(Object.keys(WIDGET_TITLES)).toHaveLength(8);
    for (const id of DEFAULT_WIDGET_ORDER) {
      expect(WIDGET_TITLES[id]).toBeDefined();
    }
  });

  it("resolveWidgetOrder returns DEFAULT_WIDGET_ORDER when null or empty", () => {
    expect(resolveWidgetOrder(null)).toEqual(DEFAULT_WIDGET_ORDER);
    expect(resolveWidgetOrder(undefined)).toEqual(DEFAULT_WIDGET_ORDER);
    expect(resolveWidgetOrder([])).toEqual(DEFAULT_WIDGET_ORDER);
  });

  it("resolveWidgetOrder preserves custom order and appends missing widgets", () => {
    const custom: WidgetId[] = ["lowStock", "sales"];
    const resolved = resolveWidgetOrder(custom);
    expect(resolved[0]).toBe("lowStock");
    expect(resolved[1]).toBe("sales");
    expect(resolved).toHaveLength(8);
    // Missing widgets appended
    expect(resolved).toContain("grossProfit");
    expect(resolved).toContain("containersInTransit");
  });

  it("resolveWidgetOrder drops duplicate and invalid widget IDs", () => {
    const withDuplicates = [
      "sales",
      "sales",
      "invalid_id",
      "topProducts",
    ] as unknown as WidgetId[];
    const resolved = resolveWidgetOrder(withDuplicates);
    expect(resolved.filter((id) => id === "sales")).toHaveLength(1);
    expect(resolved).not.toContain("invalid_id");
    expect(resolved).toHaveLength(8);
  });

  it("resolveAllowedWidgets redacts grossProfit and receivables when false", () => {
    const fullOrder = [...DEFAULT_WIDGET_ORDER];
    const allowedForEmployee = resolveAllowedWidgets(fullOrder, false, false);
    expect(allowedForEmployee).not.toContain("grossProfit");
    expect(allowedForEmployee).not.toContain("receivables");
    expect(allowedForEmployee).toHaveLength(6);

    const allowedForOwner = resolveAllowedWidgets(fullOrder, true, true);
    expect(allowedForOwner).toContain("grossProfit");
    expect(allowedForOwner).toContain("receivables");
    expect(allowedForOwner).toHaveLength(8);
  });

  it("toggleWidgetHidden toggles widget visibility correctly", () => {
    const initialHidden = new Set<WidgetId>(["sales"]);
    // Toggle sales -> unhide
    const afterUnhide = toggleWidgetHidden(initialHidden, "sales");
    expect(afterUnhide).not.toContain("sales");

    // Toggle lowStock -> hide
    const afterHide = toggleWidgetHidden(new Set(afterUnhide), "lowStock");
    expect(afterHide).toContain("lowStock");
  });
});
