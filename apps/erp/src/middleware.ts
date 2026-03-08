import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@cendaro/auth/middleware";

const PUBLIC_ROUTES = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
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

  // eslint-disable-next-line no-restricted-properties
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // eslint-disable-next-line no-restricted-properties
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  // If env vars are missing, allow request through (will fail later gracefully)
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  // API/tRPC routes handle their own auth — skip middleware auth to avoid double verification
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createSupabaseMiddlewareClient(
    {
      request: {
        getAll: () =>
          request.cookies.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          })),
        set: (name: string, value: string, options: Record<string, unknown>) => {
          request.cookies.set({ name, value, ...options });
        },
      },
      response: {
        getAll: () =>
          response.cookies.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          })),
        set: (name: string, value: string, options: Record<string, unknown>) => {
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
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

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
