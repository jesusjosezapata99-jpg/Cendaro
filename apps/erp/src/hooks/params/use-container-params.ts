"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/containers` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `containerId` opens container detail sheet, `createContainer` opens create container sheet.
 */
export const containerParamsParsers = {
  containerId: parseAsString.withDefault(""),
  createContainer: parseAsBoolean.withDefault(false),
};

export function useContainerParams() {
  return useQueryStates(containerParamsParsers);
}
