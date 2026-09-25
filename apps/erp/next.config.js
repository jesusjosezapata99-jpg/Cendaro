import { withSentryConfig } from "@sentry/nextjs/config";

import { buildContentSecurityPolicy } from "./csp.mjs";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  /** Enable gzip compression for all responses */
  compress: true,
  /** Remove X-Powered-By header for security */
  poweredByHeader: false,
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@cendaro/api",
    "@cendaro/auth",
    "@cendaro/db",
    "@cendaro/ui",
    "@cendaro/validators",
  ],
  /** Tree-shake heavy packages for smaller bundles */
  cacheComponents: true,
  experimental: {
    optimizePackageImports: [
      "@cendaro/ui",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@supabase/ssr",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@trpc/client",
      "@trpc/tanstack-react-query",
      "clsx",
      "framer-motion",
      "nuqs",
      "react-icons",
      "recharts",
      "sonner",
      "superjson",
      "zod",
    ],
    // Turbopack's persistent dev cache is disabled deliberately (2026-09-14).
    // It caused two distinct dev-server crashes in one session: a restore
    // panic with missing `.sst` files, and an internal `turbo-tasks`
    // aggregation panic. Both surfaced as 500s on every route, which reads
    // as an application bug and undermines any verification done against
    // the dev server. Re-enable once the option stabilises upstream.
    // turbopackFileSystemCacheForDev: true,
  },
  /** Sharp uses native binaries — must not be bundled */
  serverExternalPackages: ["sharp"],
  /** HTTP cache and security headers for API routes */
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";

    // CSP policy and the reason it is not nonce-based: see ./csp.mjs.
    const ContentSecurityPolicy = buildContentSecurityPolicy(isDev);

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]),
          {
            key: "Content-Security-Policy",
            value: ContentSecurityPolicy,
          },
        ],
      },
      {
        // Landing media is content-hashed per directory
        // (scripts/landing-media, PLAN-2026-09-LANDING-REDESIGN T1.6): a new
        // recording gets a new URL, so the CDN and browsers keep it forever.
        source: "/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/trpc/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
          { key: "Vary", value: "Accept-Encoding" },
        ],
      },
    ];
  },
};

export default withSentryConfig(config, {
  org: "cendaro",
  project: "javascript-nextjs",
  // Source maps upload only when the build has SENTRY_AUTH_TOKEN (a Vercel
  // env var). Local and CI builds without it skip the upload instead of
  // failing.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  // Browser events go through /monitoring on our own origin: ad blockers
  // don't drop them and CSP 'self' covers them. The route is public in
  // src/lib/public-routes.ts.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  telemetry: false,
});
