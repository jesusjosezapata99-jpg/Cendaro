"use client";

import { parseAsBoolean, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/cash-closure` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `createClosure` opens cash closure sheet.
 */
export const closureParamsParsers = {
  createClosure: parseAsBoolean.withDefault(false),
};

export function useClosureParams() {
  return useQueryStates(closureParamsParsers);
}
