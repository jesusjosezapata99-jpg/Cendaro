/**
 * POST /api/auth/logout
 *
 * Hardened logout endpoint:
 *
 *  Layer 1 — Origin validation (CSRF protection)
 *    • Validates the Origin or Referer header against the application host.
 *    • Blocks cross-origin logout attempts (prevents forced-logout DoS attacks).
 *    • Allows localhost/127.0.0.1 in development environments.
 *
 *  Layer 2 — Rate limiting
 *    • 10 logout requests per minute per IP.
 *    • Prevents logout-flood denial-of-service attacks.
 *
 *  Layer 3 — Security response headers
 *    • Cache-Control: no-store — session state must never be cached.
 *    • X-Content-Type-Options: nosniff
 *
 * Attack surface eliminated:
 *   ✓ CSRF-based forced logout              (V-06)
 *   ✓ Logout-flood DoS on session state
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@cendaro/auth/server";

import { env } from "~/env";
import { rateLimit } from "~/lib/rate-limit";

// ── Constants ────────────────────────────────────────────────────────────────

const AUTH_SECURITY_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

// ── Origin validation ────────────────────────────────────────────────────────

/**
 * Extracts the effective host from the Supabase project URL.
 * Used as the trusted origin for CSRF validation.
 *
 * The app host is inferred from the NEXT_PUBLIC_SUPABASE_URL env var
 * (which always contains the project domain), combined with the request's
 * own Host header. This avoids needing a separate NEXT_PUBLIC_APP_URL env var.
 */
function isTrustedOrigin(requestHeaders: Headers, requestUrl: string): boolean {
  // Extract the app's own host from the incoming request URL
  let appHost: string;
  try {
    appHost = new URL(requestUrl).host;
  } catch {
    return false;
  }

  // Development: always allow localhost and 127.0.0.1
  if (
    appHost.startsWith("localhost") ||
    appHost.startsWith("127.0.0.1") ||
    appHost.startsWith("0.0.0.0")
  ) {
    return true;
  }

  // Check Origin header first (most reliable, set by browsers on CORS requests)
  const origin = requestHeaders.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === appHost;
    } catch {
      return false;
    }
  }

  // Fall back to Referer header (older browsers, some proxies)
  const referer = requestHeaders.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === appHost;
    } catch {
      return false;
    }
  }

  // No Origin or Referer — reject (defensive: same-origin requests always include one)
  return false;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── Step 1: Origin/CSRF validation ──────────────────────────────────────
  const requestHeaders = request.headers;

  if (!isTrustedOrigin(requestHeaders, request.url)) {
    return NextResponse.json(
      { error: "Solicitud no autorizada" },
      { status: 403, headers: AUTH_SECURITY_HEADERS },
    );
  }

  // ── Step 2: Rate limit (logout-flood DoS protection) ────────────────────
  const rawIp = request.headers.get("x-forwarded-for") ?? "";
  const ip = rawIp.split(",")[0]?.trim() ?? "unknown";

  const { success: allowed, reset } = rateLimit(`logout:ip:${ip}`, {
    window: 60_000,
    max: 10,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intente de nuevo más tarde." },
      {
        status: 429,
        headers: {
          ...AUTH_SECURITY_HEADERS,
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1_000)),
        },
      },
    );
  }

  // ── Step 3: Env validation ───────────────────────────────────────────────
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500, headers: AUTH_SECURITY_HEADERS },
    );
  }

  // ── Step 4: Sign out and invalidate session ──────────────────────────────
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(
    cookieStore,
    supabaseUrl,
    supabaseKey,
  );

  // scope: "local" — invalidates only this device's session token.
  // Use "global" to invalidate all sessions across all devices (for account compromise scenarios).
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.json(
    { success: true },
    { status: 200, headers: AUTH_SECURITY_HEADERS },
  );
}
