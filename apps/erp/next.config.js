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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
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
