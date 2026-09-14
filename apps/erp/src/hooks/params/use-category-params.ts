"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/catalog/categories` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `categoryId` opens category detail sheet, and `createCategory` opens create category sheet.
 */
export const categoryParamsParsers = {
  categoryId: parseAsString.withDefault(""),
  createCategory: parseAsBoolean.withDefault(false),
};

export function useCategoryParams() {
  return useQueryStates(categoryParamsParsers);
}
