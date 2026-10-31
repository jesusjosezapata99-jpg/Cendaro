# Progress — explorer_performance_r3

Last visited: 2026-10-30T23:19:00Z

## Status

All empirical and quantitative investigations across the 5 dimensions are complete. Verification gates (`typecheck`, `lint`, `test`, `design-guard`) executed and documented. Compiling `report.md` and `handoff.md`.

## Milestones & Steps

- [x] Step 0: Bootstrap & Context Hydration (rules, stack, architecture, security remediation report)
- [x] Step 1: Database & Connection Latency Audit (`packages/db/src/`, `packages/api/src/routers/`)
  - [x] Pool configuration, timeouts, Supavisor port 6543 vs 5432 (pool max 5 per instance vs 15 total backend slots)
  - [x] RLS wrapper overhead & transaction serialization (`runInWorkspaceRlsReadonly` adds 3 RTTs; `Promise.all` queries inside serialize on single client)
  - [x] Overhead in `protectedProcedure`: `touchSessionActivity` runs 2 sequential DB queries per request
  - [x] N+1 query patterns and cascading sequential queries in routers (e.g. `applyStockLifecycle` in POS loops over items with 3 round trips each: 15 items = 45 sequential round trips)
  - [x] Schema indexing audit (missing composite indexes for workspace-scoped pagination: `(workspace_id, created_at DESC)` missing on `Product` and `SalesOrder`; barcode index is single-column, not workspace-scoped)
  - [x] Payload sizes and pagination mechanisms (`stockOverview` dumps 500 records on POS mount; `cursor` is implemented as `OFFSET`, degrading O(N))
- [x] Step 2: Adversarial Network Analysis (Venezuela to Cloud)
  - [x] RTT calculations, jitter, packet loss impact (CANTV, Fibex, Inter, Netuno: 120ms-350ms RTT, 2-10% packet loss)
  - [x] Multi-hop latency model (Client -> Vercel Edge/Serverless -> Supabase -> Vercel -> Client)
  - [x] Cumulative latency calculated for barcode scan (675-1,025ms on un-cached scan), POS checkout (1.7-2.0s baseline, 3.5-5.5s with packet loss), and POS mount (2.8-4.5s)
  - [x] Mutation resilience: checkoutPos lacks `idempotencyKey`, risk of duplicate charges/orders on network timeout retry
  - [x] POS continuity: ZERO offline support (no service worker, no IndexedDB, no offline sales queue, localStorage only stores `workspaceId`)
  - [x] Cache-Control: tRPC explicitly sends `no-cache, private`, preventing any Edge CDN caching even for static catalogs and daily exchange rates
- [x] Step 3: Animation Fluency & UI Responsiveness (Low-Spec POS Hardware)
  - [x] Framer Motion `AnimatedSizeContainer` animates `width` and `height` using spring physics + ResizeObserver -> continuous layout reflow (Reflow thrashing)
  - [x] `.search-results-list` animates `height` with CSS transition -> layout thrashing
  - [x] Shimmer skeletons animate `background-position` linearly infinite -> continuous paint invalidation rectangles
  - [x] Hardware evaluation: Intel Celeron / Atom POS terminals (2-4 low IPC cores, 4GB RAM) suffer frame drops, UI stutter, and INP degradation under concurrent animation + DOM rendering
  - [x] `prefers-reduced-motion` exists in `globals.css` but there is no application-level "Low Spec / Performance Mode" toggle
- [x] Step 4: Bundle Size & Frontend Asset Delivery
  - [x] Next.js 16 tree-shaking with `optimizePackageImports` configured
  - [x] Font loading strategy: Hedvig Letters Sans (`display: swap`, `latin` subset) + Geist Mono; FOUT/layout shift risks on slow Venezuelan links
- [x] Step 5: Concrete Architectural Proposals & Mitigations
  - [x] Idempotency keys (`x-idempotency-key`) and duplicate submission lock
  - [x] Batch stock deduction CTE / stored function replacing N+1 loop in `applyStockLifecycle`
  - [x] Keyset cursor pagination and composite indexes `(workspace_id, created_at DESC)`
  - [x] Local IndexedDB offline queue + local catalog cache for POS continuity during Venezuelan blackouts/outages
  - [x] Edge caching (Stale-While-Revalidate) for catalogs and exchange rates
  - [x] GPU-only transform animations, replacing `AnimatedSizeContainer` with grid CSS or direct toggle, plus POS Performance Mode
- [x] Step 6: Repo Verification Checks
  - [x] `pnpm typecheck` passed (6 packages)
  - [x] `pnpm lint` passed (6 packages)
  - [x] `pnpm test` passed (1,206 tests across validators, api, erp)
  - [x] `design-guard.mjs --phase F9` passed
- [ ] Step 7: Final Report Compilation (`report.md`) & Handoff (`handoff.md`)
