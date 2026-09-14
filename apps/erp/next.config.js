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

    // Content-Security-Policy directives:
    //   script-src 'unsafe-inline' — required by Next.js for inline hydration
    //   script-src 'unsafe-eval' — required by React 19 / Turbopack in development mode for
    //              sourcemap decoding, stack trace reconstruction, and Fast Refresh
    //   style-src  'unsafe-inline' — Tailwind + Next inline styles. All fonts
    //              are self-hosted via next/font (no external font CDNs).
    //   img-src    *.supabase.co — product images in Supabase Storage
    //              blob: data: — AI image previews in the packing-list pipeline
    //   connect-src ws: wss: (dev) — Turbopack HMR / Fast Refresh WebSocket connections
    //   connect-src (all) — Supabase API, Groq AI, Sentry telemetry, exchange-rate APIs
    //   frame-ancestors 'none' — clickjacking prevention (CSP-level, supplements X-Frame-Options)
    const ContentSecurityPolicy = [
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
        source: "/api/trpc/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
          { key: "Vary", value: "Accept-Encoding" },
        ],
      },
    ];
  },
};

export default config;
