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
  "/reports",
];

/**
 * Validates and normalizes a `?redirect=` destination path after login (F9.2).
 *
 * Security invariants:
 * - Rejects null/empty, external URLs (`https://...`), protocol-relative URLs
 *   (`//evil.com`), backslash tricks (`/\evil.com`), and control characters.
 * - Requires the pathname to match an entry in `REDIRECT_ALLOWLIST_PREFIX`
 *   (either exact or followed by `/` or `?`).
 * - Returns `fallback` (`/dashboard`) whenever validation fails.
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return fallback;
  }
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, "https://cendaro.internal");
  } catch {
    return fallback;
  }

  if (parsed.origin !== "https://cendaro.internal") {
    return fallback;
  }

  const pathname = parsed.pathname;
  const isAllowed = REDIRECT_ALLOWLIST_PREFIX.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isAllowed) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}`;
}
