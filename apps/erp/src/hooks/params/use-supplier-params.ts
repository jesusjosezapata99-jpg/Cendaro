"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/catalog/suppliers` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `supplierId` opens supplier detail sheet, and `createSupplier` opens create supplier sheet.
 */
export const supplierParamsParsers = {
  supplierId: parseAsString.withDefault(""),
  createSupplier: parseAsBoolean.withDefault(false),
};

export function useSupplierParams() {
  return useQueryStates(supplierParamsParsers);
}
