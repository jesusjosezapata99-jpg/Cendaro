"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/customers` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `customerId` opens customer detail sheet, `createCustomer` opens create customer sheet.
 */
export const customerParamsParsers = {
  customerId: parseAsString.withDefault(""),
  createCustomer: parseAsBoolean.withDefault(false),
  search: parseAsString.withDefault(""),
  type: parseAsString.withDefault("all"),
};

export function useCustomerParams() {
  return useQueryStates(customerParamsParsers);
}
