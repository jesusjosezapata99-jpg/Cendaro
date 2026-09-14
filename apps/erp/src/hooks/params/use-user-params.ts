"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/users` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `userId` opens user detail sheet, `createUser` opens create user sheet,
 * and `editUser` opens edit user sheet with target user ID.
 */
export const userParamsParsers = {
  userId: parseAsString.withDefault(""),
  createUser: parseAsBoolean.withDefault(false),
  editUser: parseAsString.withDefault(""),
};

export function useUserParams() {
  return useQueryStates(userParamsParsers);
}
