# DISPATCH — explorer_performance_r3

## Assignment

Execute R3: Performance, Latency & Venezuela / Cloud & Animation Audit of Cendaro ERP.

### Working Directory

`c:\Users\jzs99\Desktop\TEST\.agents\teamwork\explorer_performance_r3\`

### Scope of Investigation

1. **Database & Query Latency**:
   - Connection models to Supabase (`ljwoptpaxazqmnhdczsb`): direct connection vs transaction pooler (Supavisor / port 6543 vs 5432).
   - Drizzle ORM query patterns: identify N+1 queries, lack of indexes on high-cardinality foreign keys (`workspace_id`, `created_at`, product lookups, barcode searches).
   - Overhead of serverless cold starts and multi-hop API requests (Client -> Vercel Edge/Serverless -> Supabase PostgreSQL).
2. **Local vs Cloud Performance Under Adversarial Network Conditions (Venezuela)**:
   - High round-trip time (RTT typically 120ms - 350ms+ to US-East / AWS us-east-1).
   - High jitter and packet loss (2% - 10%+).
   - How does the application behave on degraded connectivity? (POS stall risks, timeout thresholds, duplicate submission on retries).
   - Offline / resilient capabilities: Is there service worker / local storage / indexedDB caching for POS transactions and critical employee operations?
   - Caching layers: Next.js 16 cache, React `cache`, optimistic UI updates in tRPC/TanStack Query.
3. **Animation Fluency & UI Performance**:
   - CSS animations vs JS-driven transitions: audit Tailwind classes and CSS in `packages/ui` and `apps/erp`.
   - Layout shifts (CLS), First Input Delay (FID/INP), Largest Contentful Paint (LCP) bottlenecks.
   - Bundle size analysis: heavy dependencies, dynamic imports, SSR streaming vs blocking waterfall.
   - Impact of animations when running on low-spec client hardware common in Venezuelan retail/wholesale environments (Celeron / older Core i3 POS terminals, tablets).
4. **Concrete Recommendations**:
   - Concrete, benchmarked architectural mitigations (e.g. edge caching, Supavisor optimization, TanStack Query persistence, optimistic mutations, offline queueing).
5. **Deliverable**:
   - Write comprehensive report to `report.md` in your working directory and deliver a complete `handoff.md`.
   - DO NOT modify any code.

## 2026-10-30T23:11:12Z

Received dispatch from parent (22137723-b5bb-491b-a106-88e732dbffe5):
Execute R3: Performance, Latency & Venezuela / Cloud & Animation Audit of Cendaro ERP.

- Database & Connection Latency Audit (Supabase pooler, Drizzle queries, N+1, indexes, payload sizes)
- Network Realities from Venezuela (120ms - 350ms RTT, packet loss, multi-hop latency, resilience, offline/caching)
- Animation Fluency & UI Responsiveness (packages/ui, apps/erp, low-spec hardware, Celeron/Atom POS)
- Bundle Size & Frontend Asset Delivery (Next.js 16, RSC boundaries, Hedvig fonts)
- Concrete Architectural Solutions & Proposals
  Deliverables: report.md and handoff.md.
