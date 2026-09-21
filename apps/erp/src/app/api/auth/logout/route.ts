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
import { isTrustedOrigin } from "~/lib/trusted-origin";

// ── Constants ────────────────────────────────────────────────────────────────

const AUTH_SECURITY_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

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

  const { success: allowed, reset } = await rateLimit(`logout:ip:${ip}`, {
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
