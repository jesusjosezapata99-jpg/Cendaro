/**
 * Whitelist of path prefixes safe to redirect to after login
 * (`?redirect=` in `proxy.ts`). Prevents open-redirect attacks.
 *
 * Kept as its own module (no other imports) so it can also be asserted
 * against `NAV_ITEMS` (`~/lib/navigation.ts`) in a plain Vitest test
 * without dragging in `~/env` / Supabase middleware.
 */
export const REDIRECT_ALLOWLIST_PREFIX = [
  "/dashboard",
  "/catalog",
  "/inventory",
  "/containers",
  "/pos",
  "/rates",
  "/pricing",
  "/orders",
  "/quotes",
  "/customers",
  "/payments",
  "/cash-closure",
  "/delivery-notes",
  "/invoices",
  "/vendors",
  "/accounts-receivable",
  "/marketplace",
  "/whatsapp",
  "/users",
  "/audit",
  "/alerts",
  "/settings",
];
