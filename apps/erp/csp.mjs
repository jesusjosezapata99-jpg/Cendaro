/**
 * Content-Security-Policy for every response (PLAN-2026-09-SECURITY-REMEDIATION
 * F9.1, finding M3). Plain ESM so both `next.config.js` and the unit test can
 * import it.
 *
 * Why not a nonce: Next 16 applies nonces only while server-rendering a
 * request, and the docs state Partial Prerendering (`cacheComponents: true`,
 * enabled here) is incompatible with nonce-based CSP — the static shell, which
 * carries ~12 page-specific inline scripts (`self.__next_f.push(...)`, the
 * theme bootstrap), is built without any request. A nonce/`strict-dynamic`
 * policy therefore blocked every script on `/` and `/login` in production
 * (measured 2026-09-21: 29 script tags, 0 with a nonce).
 *
 * What this policy does instead: `'unsafe-eval'` is development-only
 * (Turbopack sourcemaps / Fast Refresh) — production no longer allows eval —
 * and every other directive stays strict. `'unsafe-inline'` remains for
 * script-src as the accepted residual risk of M3; revisit if the app moves
 * off Partial Prerendering.
 *
 * @param {boolean} isDev
 * @returns {string}
 */
export function buildContentSecurityPolicy(isDev) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""} https://*.supabase.co https://api.groq.com https://ve.dolarapi.com https://api.frankfurter.dev https://v6.exchangerate-api.com https://*.sentry.io`,
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
