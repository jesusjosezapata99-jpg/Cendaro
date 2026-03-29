import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseMiddlewareClient } from "@cendaro/auth/middleware";

import { env } from "~/env";

const PUBLIC_ROUTES_EXACT = ["/"];
const PUBLIC_ROUTES_PREFIX = ["/login", "/api/auth"];

/**
 * Security headers injected on all /api/auth/* responses.
 * These supplement headers set by the individual route handlers.
 */
const GLOBAL_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/**
 * ALLOWED_REDIRECT_PATHS — whitelist of paths that are safe to redirect to
 * after login. Prevents open-redirect attacks via the ?redirect= parameter.
 */
const REDIRECT_ALLOWLIST_PREFIX = [
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes (exact match for landing, prefix for login/api)
  if (
    PUBLIC_ROUTES_EXACT.includes(pathname) ||
    PUBLIC_ROUTES_PREFIX.some((route) => pathname.startsWith(route))
  ) {
    const res = NextResponse.next();

    // Inject security headers on all auth API responses
    if (pathname.startsWith("/api/auth")) {
      for (const [key, value] of Object.entries(GLOBAL_SECURITY_HEADERS)) {
        res.headers.set(key, value);
      }
    }

    // Prevent search engines from indexing the login page
    if (pathname.startsWith("/login")) {
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
    }

    return res;
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing, allow request through (will fail later gracefully)
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  // API/tRPC routes handle their own auth — skip proxy auth to avoid double verification
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Forward workspace cookie as request header for RSC context
  const wsId = request.cookies.get("cendaro-workspace-id")?.value;
  const requestHeaders = new Headers(request.headers);
  if (wsId) {
    requestHeaders.set("x-workspace-id", wsId);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createSupabaseMiddlewareClient(
    {
      request: {
        getAll: () =>
          request.cookies.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          })),
        set: (
          name: string,
          value: string,
          options: Record<string, unknown>,
        ) => {
          request.cookies.set({ name, value, ...options });
        },
      },
      response: {
        getAll: () =>
          response.cookies.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          })),
        set: (
          name: string,
          value: string,
          options: Record<string, unknown>,
        ) => {
          response.cookies.set({ name, value, ...options });
        },
      },
    },
    supabaseUrl,
    supabaseKey,
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (page routes only)
  if (!user) {
    const loginUrl = new URL("/login", request.url);

    // Only embed the redirect param if the destination is on the allowlist.
    // This prevents open-redirect attacks where ?redirect=https://evil.com
    // could be injected by a malicious link.
    const isSafeRedirect = REDIRECT_ALLOWLIST_PREFIX.some((prefix) =>
      pathname.startsWith(prefix),
    );
    if (isSafeRedirect) {
      loginUrl.searchParams.set("redirect", pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  // ── MFA AAL2 Enforcement ─────────────────────────────────────────────
  //
  // If the user has MFA factors enrolled but hasn't completed the MFA
  // challenge in this session, they are at aal1 (password-only).
  // Force them to complete the MFA challenge before accessing the app.
  //
  // This prevents bypassing MFA by:
  //   1. Logging in (password → aal1)
  //   2. Navigating directly to /dashboard without completing /login/mfa
  //
  const { data: aalData } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalData) {
    const { currentLevel, nextLevel } = aalData;
    // User has MFA factors but session hasn't been upgraded to aal2
    if (nextLevel === "aal2" && currentLevel !== "aal2") {
      return NextResponse.redirect(new URL("/login/mfa", request.url));
    }
  }

  // ── Idle Session Timeout ──────────────────────────────────────────────
  //
  // Track last activity timestamp in a cookie. If the user has been
  // inactive for more than 30 minutes, force reauthentication.
  // This mitigates session hijacking from unattended devices.
  //
  const IDLE_TIMEOUT_MS = 30 * 60 * 1_000; // 30 minutes
  const ACTIVITY_COOKIE = "cendaro-last-activity";

  const lastActivity = request.cookies.get(ACTIVITY_COOKIE)?.value;
  const now = Date.now();

  if (lastActivity) {
    const elapsed = now - Number(lastActivity);
    if (elapsed > IDLE_TIMEOUT_MS) {
      // Session expired — sign out and redirect to login
      // We can't call supabase.auth.signOut() in middleware reliably,
      // so we clear the activity cookie and let the expired JWT handle it
      const expiredUrl = new URL("/login", request.url);
      expiredUrl.searchParams.set("expired", "1");
      const expiredResponse = NextResponse.redirect(expiredUrl);
      expiredResponse.cookies.delete(ACTIVITY_COOKIE);
      return expiredResponse;
    }
  }

  // Update activity timestamp on every authenticated request
  response.cookies.set(ACTIVITY_COOKIE, String(now), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: IDLE_TIMEOUT_MS / 1_000, // cookie expires with the timeout
  });

  // Redirect authenticated users away from login
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
