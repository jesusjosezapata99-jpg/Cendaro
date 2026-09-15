/**
 * Canonical public route allowlists for Next.js proxy middleware.
 * Single source of truth for public access boundaries (PLAN-2026-09-AUDIT-CLOSEOUT §C3/C4).
 */

export const PUBLIC_ROUTES_EXACT: readonly string[] = ["/", "/opengraph-image"];

export const PUBLIC_ROUTES_PREFIX: readonly string[] = ["/login", "/api/auth"];
