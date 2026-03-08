/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  /** Enable gzip compression for all responses */
  compress: true,
  /** Remove X-Powered-By header for security */
  poweredByHeader: false,
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@omnicore/api",
    "@omnicore/auth",
    "@omnicore/db",
    "@omnicore/ui",
    "@omnicore/validators",
  ],
  /** Already handled by Turbo */
  typescript: { ignoreBuildErrors: true },
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
