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
  experimental: {
    optimizePackageImports: [
      "@trpc/client",
      "@trpc/tanstack-react-query",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "@supabase/ssr",
      "clsx",
      "sonner",
      "superjson",
      "zod",
    ],
  },
  /** Sharp uses native binaries — must not be bundled */
  serverExternalPackages: ["sharp"],
  /** HTTP cache and security headers for API routes */
  async headers() {
    // Content-Security-Policy directives:
    //   script-src 'unsafe-inline' — required by Next.js for inline hydration
    //   style-src  fonts.googleapis.com — Google Fonts CSS
    //   font-src   fonts.gstatic.com — Google Fonts static assets
    //   img-src    *.supabase.co — product images in Supabase Storage
    //              blob: data: — AI image previews in the packing-list pipeline
    //   connect-src — Supabase API, Groq AI, Sentry telemetry, exchange-rate APIs
    //   frame-ancestors 'none' — clickjacking prevention (CSP-level, supplements X-Frame-Options)
    const ContentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "media-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "connect-src 'self' https://*.supabase.co https://api.groq.com https://ve.dolarapi.com https://api.frankfurter.dev https://v6.exchangerate-api.com https://*.sentry.io",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
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
