"use client";

import { parseAsArrayOf, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted filter and sort parameters for `/inventory` and `/inventory/warehouse/[id]`
 * (PLAN-2026-09-DESIGN-SYSTEM §T4.2).
 *
 * Supports search term, stock status (`in_stock` | `low_stock` | `out_of_stock` | `all`),
 * multi-status array, warehouse selection, and sort order (`col:asc` / `col:desc`).
 * `shallow: false` ensures server-side data fetching triggers on filter changes.
 */
export const inventoryFilterParsers = {
  search: parseAsString.withDefault(""),
  status: parseAsString.withDefault("all"),
  statuses: parseAsArrayOf(parseAsString).withDefault([]),
  warehouseId: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
};

export interface InventoryFilterParams {
  search: string;
  status: string;
  statuses: string[];
  warehouseId: string;
  sort: string;
}

export function useInventoryFilterParams() {
  return useQueryStates(inventoryFilterParsers, {
    shallow: false,
  });
}
