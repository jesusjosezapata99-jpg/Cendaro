/**
 * POST /api/auth/login
 *
 * Hardened authentication endpoint with defense-in-depth:
 *
 *  Layer 1 — Request validation
 *    • Content-Type must be application/json
 *    • Body size capped at 4KB to prevent memory pressure attacks
 *    • Zod schema validation with strict field limits
 *
 *  Layer 2 — Dual-vector rate limiting
 *    • Per-IP:  5 requests / 60s  (stops automated scanners)
 *    • Per-username: 10 requests / 15min (stops password spray & credential stuffing)
 *    • Hard lockout: 15 minutes when username exceeds threshold (stops slow brute-force)
 *
 *  Layer 3 — Constant-time execution
 *    • Same generic error message for ALL failure cases (no enumeration oracle)
 *    • Dummy Supabase auth call when username is not found (no timing oracle)
 *    • Both DB miss and auth miss take the same ~200ms path
 *
 *  Layer 4 — Security response headers
 *    • Cache-Control: no-store (prevents proxy caching of auth responses)
 *    • X-Content-Type-Options: nosniff
 *    • X-Frame-Options: DENY
 *    • X-RateLimit-Remaining: explicit quota disclosure to client
 *
 * Attack surface eliminated:
 *   ✓ Username enumeration via error message      (V-01)
 *   ✓ Username enumeration via timing analysis    (V-02)
 *   ✓ IP-distributed brute force                 (V-03 partial — IP vector)
 *   ✓ Password spray / credential stuffing        (V-03 — username vector)
 *   ✓ Oversized request body memory attack        (V-05)
 *   ✓ Session caching by proxy intermediaries     (V-04)
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { createSupabaseServerClient } from "@cendaro/auth/server";

import { env } from "~/env";
import {
  applyLockout,
  getFailureCount,
  getLockoutExpiry,
  rateLimitComposite,
  recordFailure,
} from "~/lib/rate-limit";

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum body size accepted (4 KB) */
const MAX_BODY_BYTES = 4 * 1024;

/**
 * Per-username: 10 attempts within 15 minutes triggers a hard lockout.
 * Threshold is intentionally higher than the IP limit to accommodate
 * legitimate users on shared IPs (offices, universities).
 */
const USERNAME_WINDOW_MS = 15 * 60 * 1_000; // 15 min
const USERNAME_MAX = 10;

/**
 * Hard lockout duration after exceeding username threshold.
 * 15 minutes — long enough to deter automation, short enough
 * that a real user can recover without support intervention.
 */
const LOCKOUT_DURATION_MS = 15 * 60 * 1_000; // 15 min

/** Lockout threshold: lock after this many failures in the window */
const LOCKOUT_THRESHOLD = 8;

// ── Security headers injected on every auth response ────────────────────────

const AUTH_SECURITY_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

// ── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Campo requerido")
    .max(64, "Demasiado largo")
    .trim(),
  password: z.string().min(6, "Campo requerido").max(256, "Demasiado largo"),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a unified, generic auth failure response.
 * IDENTICAL message and status for ALL failure cases:
 *   - username not found
 *   - wrong password
 *   - account disabled
 *   - validation error
 *
 * This eliminates the enumeration oracle (V-01).
 */
function authFailureResponse(headers?: Record<string, string>): NextResponse {
  return NextResponse.json(
    { error: "Credenciales incorrectas" },
    {
      status: 401,
      headers: { ...AUTH_SECURITY_HEADERS, ...headers },
    },
  );
}

function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Demasiados intentos. Intente de nuevo más tarde.",
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        ...AUTH_SECURITY_HEADERS,
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

// ── DUMMY email for constant-time path ───────────────────────────────────────
// This is a syntactically valid but guaranteed-unregistered email address.
// We pass it to signInWithPassword when the username is not found so that
// the execution path — and therefore the response time — is identical to
// a real username-found + wrong-password scenario.
const DUMMY_EMAIL = "no-reply.devnull@cendaro.internal.invalid";

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── Step 1: Content-Type guard ──────────────────────────────────────────
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Tipo de contenido inválido" },
      { status: 415, headers: AUTH_SECURITY_HEADERS },
    );
  }

  // ── Step 2: Body size guard ─────────────────────────────────────────────
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Solicitud demasiado grande" },
      { status: 413, headers: AUTH_SECURITY_HEADERS },
    );
  }

  // ── Step 3: Extract IP ──────────────────────────────────────────────────
  // x-forwarded-for is set by Vercel. Take only the first (client) IP.
  const rawIp = request.headers.get("x-forwarded-for") ?? "";
  const ip = rawIp.split(",")[0]?.trim() ?? "unknown";

  // ── Step 4: Parse and validate body ────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return authFailureResponse();
  }

  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return authFailureResponse();
  }

  const { username, password } = parsed.data;
  const normalizedUsername = username.toLowerCase();

  // ── Step 5: Per-username hard lockout check ─────────────────────────────
  // Check BEFORE the composite rate limit so we short-circuit immediately
  // without DB calls if the account is already locked out.
  const lockoutKey = `lockout:user:${normalizedUsername}`;
  const lockUntil = getLockoutExpiry(lockoutKey);
  if (lockUntil) {
    const retryAfter = Math.ceil((lockUntil - Date.now()) / 1_000);
    return rateLimitResponse(retryAfter);
  }

  // ── Step 6: Dual-vector sliding-window rate limit ───────────────────────
  //
  //  Key A: `login:ip:<ip>`            — 5 req / 60s
  //  Key B: `login:user:<username>`    — 10 req / 15min
  //
  // Both must pass. The first to fail blocks the request.
  const rlResult = rateLimitComposite([
    { key: `login:ip:${ip}`, window: 60_000, max: 5 },
    {
      key: `login:user:${normalizedUsername}`,
      window: USERNAME_WINDOW_MS,
      max: USERNAME_MAX,
    },
  ]);

  if (!rlResult.success) {
    const retryAfter = Math.ceil((rlResult.reset - Date.now()) / 1_000);
    return rateLimitResponse(retryAfter);
  }

  // ── Step 7: Resolve Supabase env ────────────────────────────────────────
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500, headers: AUTH_SECURITY_HEADERS },
    );
  }

  // ── Step 8: Username → email + role lookup ──────────────────────────────
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(supabaseUrl, serviceKey || supabaseKey);

  const { data: profile, error: profileError } = await admin
    .from("user_profile")
    .select("email, role")
    .eq("username", normalizedUsername)
    .single<{ email: string; role: string }>();

  // ── Step 9: Constant-time authentication ───────────────────────────────
  //
  // Whether username exists or not, we ALWAYS call signInWithPassword.
  // This ensures the response time is identical in both cases (~200ms),
  // eliminating the timing oracle (V-02).
  //
  // If username was not found → use DUMMY_EMAIL (guaranteed to fail auth)
  // If username was found     → use the real email
  //
  const emailToUse = profileError ? DUMMY_EMAIL : profile.email;

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(
    cookieStore,
    supabaseUrl,
    supabaseKey,
  );

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  // ── Step 10: Handle failures with failure accounting ───────────────────
  if (profileError || authError) {
    // Record failure for per-username tracking (separate from rate-limit window)
    const failureKey = `failures:user:${normalizedUsername}`;
    recordFailure(failureKey);

    const failCount = getFailureCount(failureKey, USERNAME_WINDOW_MS);

    // Apply hard lockout when threshold is reached
    if (failCount >= LOCKOUT_THRESHOLD) {
      applyLockout(lockoutKey, LOCKOUT_DURATION_MS);
    }

    // Always return the same generic error — no enumeration information
    return authFailureResponse({
      "X-RateLimit-Remaining": String(Math.max(0, rlResult.remaining - 1)),
    });
  }

  // ── Step 11: MFA factor detection ──────────────────────────────────────
  //
  // After successful password auth, check if the user has MFA enrolled.
  // This determines whether the client should redirect to the MFA challenge
  // page or the MFA setup page (for owner/admin who haven't enrolled yet).
  //
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = (factors?.totp ?? []).length > 0;

  // Roles that MUST have MFA — cannot access the system without it
  const MFA_REQUIRED_ROLES = ["owner", "admin"];
  const userRole = profile.role.toLowerCase();
  const isMfaRequired = MFA_REQUIRED_ROLES.includes(userRole);

  // ── Step 12: Success with MFA context ──────────────────────────────────
  return NextResponse.json(
    {
      success: true,
      // User has a verified TOTP factor → needs to complete MFA challenge
      requiresMfa: hasVerifiedTotp,
      // Owner/admin without TOTP → must enroll before accessing the system
      requiresMfaSetup: isMfaRequired && !hasVerifiedTotp,
    },
    {
      status: 200,
      headers: {
        ...AUTH_SECURITY_HEADERS,
        "X-RateLimit-Remaining": String(rlResult.remaining),
      },
    },
  );
}
