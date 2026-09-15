"use client";

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from "nuqs";

/**
 * URL-persisted filter and sort parameters for `/catalog`
 * (PLAN-2026-09-DESIGN-SYSTEM §T4.2).
 *
 * Supports search term, status (single & multi), brand, category, supplier,
 * sort order (`col:asc` / `col:desc`), and legacy page offset.
 * `shallow: false` ensures server-side data fetching triggers on filter changes.
 */
export const productFilterParsers = {
  search: parseAsString.withDefault(""),
  status: parseAsString.withDefault("all"),
  statuses: parseAsArrayOf(parseAsString).withDefault([]),
  brandId: parseAsString.withDefault("all"),
  brandIds: parseAsArrayOf(parseAsString).withDefault([]),
  categoryId: parseAsString.withDefault("all"),
  categoryIds: parseAsArrayOf(parseAsString).withDefault([]),
  supplierId: parseAsString.withDefault("all"),
  supplierIds: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(0),
};

export interface ProductFilterParams {
  search: string;
  status: string;
  statuses: string[];
  brandId: string;
  brandIds: string[];
  categoryId: string;
  categoryIds: string[];
  supplierId: string;
  supplierIds: string[];
  sort: string;
  page: number;
}

export function useProductFilterParams() {
  return useQueryStates(productFilterParsers, {
    shallow: false,
  });
}
