"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/catalog/brands` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `brandId` opens brand detail sheet, and `createBrand` opens create brand sheet.
 */
export const brandParamsParsers = {
  brandId: parseAsString.withDefault(""),
  createBrand: parseAsBoolean.withDefault(false),
};

export function useBrandParams() {
  return useQueryStates(brandParamsParsers);
}
