"use client";

import {
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from "nuqs";

/**
 * URL-persisted state for `/catalog` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `productId` opens product detail sheet, `createProduct` opens create product sheet,
 * and `editProduct` opens edit product sheet.
 */
export const productParamsParsers = {
  productId: parseAsString.withDefault(""),
  createProduct: parseAsBoolean.withDefault(false),
  editProduct: parseAsString.withDefault(""),
  search: parseAsString.withDefault(""),
  status: parseAsString.withDefault("all"),
  page: parseAsInteger.withDefault(0),
};

export function useProductParams() {
  return useQueryStates(productParamsParsers);
}
