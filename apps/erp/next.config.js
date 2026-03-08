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
  /** Already handled by Turbo */
  typescript: { ignoreBuildErrors: true },
  /** Tree-shake heavy packages for smaller bundles */
  experimental: {
    optimizePackageImports: [
      "@tanstack/react-query",
      "@trpc/client",
      "@trpc/tanstack-react-query",
      "clsx",
    ],
    /** Next.js 16 router cache — avoid full reloads on client navigations */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  /** HTTP cache headers for API routes */
  async headers() {
    return [
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
