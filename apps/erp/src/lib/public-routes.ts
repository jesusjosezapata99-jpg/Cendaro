/**
 * Canonical public route allowlists for Next.js proxy middleware.
 * Single source of truth for public access boundaries (PLAN-2026-09-AUDIT-CLOSEOUT §C3/C4).
 */

export const PUBLIC_ROUTES_EXACT: readonly string[] = [
  "/",
  "/opengraph-image",
  // Public marketing site (PLAN-2026-09-LANDING-REDESIGN F1).
  "/funciones",
  "/sitemap.xml",
  "/robots.txt",
];

/**
 * `/monitoring` is the Sentry tunnel (`tunnelRoute` in next.config.js). It must
 * bypass auth: otherwise browser events from signed-out pages (login) would be
 * redirected, and events from signed-in users would refresh the idle-timeout
 * cookie. It only forwards envelopes to this project's Sentry DSN.
 */
export const PUBLIC_ROUTES_PREFIX: readonly string[] = [
  "/login",
  "/api/auth",
  "/monitoring",
  // Feature pages. The trailing slash keeps "/funcionesx" out: the proxy
  // matches prefixes with startsWith. "/funciones" itself is in EXACT.
  "/funciones/",
];
