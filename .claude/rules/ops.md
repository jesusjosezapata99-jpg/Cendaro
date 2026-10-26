---
paths:
  - "turbo.json"
  - "apps/erp/turbo.json"
  - "vercel.json"
  - "apps/erp/next.config.js"
  - "apps/erp/csp.mjs"
  - ".github/**"
---

# Build, deploy and security headers

- Turbo cache outputs list specific `.next` subfolders (`build`, `server`, `static`, `types`, `cache`, plus root JSON/JS files). A bare `.next/**` glob pulls in the dev cache and bloats the Turbo cache.
- Turborepo runs in strict env mode and filters undeclared variables out of the build. Declare build-time variables in `apps/erp/turbo.json`: `env` when the value changes the output, `passThroughEnv` for secrets. Check with `turbo run build --filter=@cendaro/erp --dry=json`. `NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing one.
- `SENTRY_AUTH_TOKEN` must be a Sentry Organization Token (it carries `org:ci`). A personal token with read-only scopes makes release and source-map uploads fail with 403.
- The Content-Security-Policy is static, in `apps/erp/csp.mjs`: no `unsafe-eval`, and `unsafe-inline` is an accepted risk. Do not introduce a nonce or `strict-dynamic` CSP: Next 16 applies nonces only while server-rendering a request, and Partial Prerendering (`cacheComponents`) ships a static shell without one, so every script gets blocked. Verify any CSP change in a real browser (React hydrates, the login form renders); `agent-browser errors` does not report CSP blocks.
