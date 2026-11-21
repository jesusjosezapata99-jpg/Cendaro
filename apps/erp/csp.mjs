/**
 * Content-Security-Policy builders for public cached shells vs authenticated
 * dynamic ERP routes (`/(app)/*`). Plain ESM so both `next.config.js`,
 * `src/proxy.ts`, and Vitest unit tests can import it directly.
 *
 * Split-Root-Layout Architecture (Next.js 16 + `cacheComponents: true`):
 *   1. Public & marketing routes (`/`, `/funciones/*`, `/login`) use static /
 *      Partial Prerendering shells built without a request (`buildContentSecurityPolicy`),
 *      where inline bootstrap scripts (`REVEAL_BOOTSTRAP`, `__next_f`) require
 *      `'unsafe-inline'` (with `'unsafe-eval'` strictly disabled in production).
 *   2. Authenticated ERP routes (`/(app)/*`) use a dedicated dynamic root layout
 *      wrapped in `<Suspense>` above `<html>`/`<body>` (`DynamicHTMLPreludeState.Empty`).
 *      `src/proxy.ts` generates a fresh 128-bit cryptographic nonce on every
 *      navigation and injects `buildAppContentSecurityPolicy` into both request
 *      and response headers, eliminating `'unsafe-inline'` from `script-src`
 *      across the entire authenticated ERP surface.
 */

const NONCE_FORMAT_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;

/**
 * Resolves and validates the configured Supabase origin.
 *
 * @param {string} [supabaseUrl]
 * @returns {string}
 */
function resolveSupabaseOrigin(supabaseUrl) {
  const rawUrl = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) {
    throw new Error("The CSP needs NEXT_PUBLIC_SUPABASE_URL");
  }
  return new URL(rawUrl).origin;
}

/**
 * Static CSP for public / prerendered routes (`/`, `/funciones/*`, `/login`, `/api/*`).
 *
 * @param {boolean} isDev
 * @param {string} [supabaseUrl] defaults to NEXT_PUBLIC_SUPABASE_URL
 * @returns {string}
 */
export function buildContentSecurityPolicy(isDev, supabaseUrl) {
  const supabaseOrigin = resolveSupabaseOrigin(supabaseUrl);

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

/**
 * Dynamic per-request nonce CSP for authenticated ERP routes (`/(app)/*`).
 * Eliminates `'unsafe-inline'` from `script-src` using CSP3 `'nonce-...'` +
 * `'strict-dynamic'` (with `'self'` retained solely as a CSP2 fallback).
 *
 * @param {boolean} isDev
 * @param {string} nonce Base64/Base64URL cryptographic per-request nonce
 * @param {string} [supabaseUrl] defaults to NEXT_PUBLIC_SUPABASE_URL
 * @returns {string}
 */
export function buildAppContentSecurityPolicy(isDev, nonce, supabaseUrl) {
  if (
    typeof nonce !== "string" ||
    nonce.length < 16 ||
    !NONCE_FORMAT_RE.test(nonce)
  ) {
    throw new Error(
      "The authenticated CSP requires a valid base64 nonce (>= 16 chars)",
    );
  }
  const supabaseOrigin = resolveSupabaseOrigin(supabaseUrl);

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
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
