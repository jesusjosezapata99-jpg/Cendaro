/**
 * Content-Security-Policy for every response (internal plan
 * F9.1, hardening item). Plain ESM so both `next.config.js` and the unit test can
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
 * @param {string} [supabaseUrl] defaults to NEXT_PUBLIC_SUPABASE_URL
 * @returns {string}
 */
export function buildContentSecurityPolicy(isDev, supabaseUrl) {
  const rawUrl = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) {
    throw new Error("The CSP needs NEXT_PUBLIC_SUPABASE_URL");
  }
  const supabaseOrigin = new URL(rawUrl).origin;

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    "media-src 'self'",
    "frame-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""} ${supabaseOrigin} https://*.sentry.io https://challenges.cloudflare.com`,
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
