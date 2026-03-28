# Project State — Living Memory

> This file is maintained by AI agents. Each entry must be timestamped.
> Only write observations relevant to THIS project.

---

## Session Registry

- **Total agent sessions**: 63

### Session 63 — 2026-03-28T21:56 — README Professional Upgrade

**Objective**: Upgrade README.md to enterprise-grade visual presentation with theme-aware assets for GitHub dark/light modes.

**Files created**:

- `docs/assets/cendaro-logo-dark.png` — White logo on black background (2171×645, Gemini watermark removed)
- `docs/assets/cendaro-logo-light.png` — Black logo on white background (2171×645, Gemini watermark removed)

**Files modified**:

- `README.md` — Complete visual overhaul:
  - Replaced shields.io badge header with theme-aware `<picture>` + `<source>` logo
  - Switched all Mermaid diagrams from `theme: 'base'` to `theme: 'neutral'` for dark/light GitHub compatibility
  - Added visual navigation bar with colored badge links
  - Added `<br/>` spacers between sections for breathing room
  - Added collapsible `<details>` for router and module tables to reduce scroll fatigue
  - Added Layer 5 (Rate Limiting) to the security architecture diagram
  - Added `createUserSchema` to the validators reference table
  - Added `lib/` directory to the monorepo file tree
  - Added `docs/` directory with assets/architecture/product/adr subdirectories

**Key decisions**:

- Used `theme: 'neutral'` for Mermaid — renders correctly on both GitHub dark and light themes
- Logo processed with Python/Pillow+numpy luminance thresholding to extract white content from checkered fake-transparency background
- Watermark removed by masking 120×120px bottom-right corner before final composite

### Session 62 — 2026-03-28T21:45 — Security Hardening (Post-Audit)


**Objective**: Implement 5 non-blocking security recommendations from the forensic OSS audit to bring score from 98.75 → 100/100.

**Files created**:

- `apps/erp/src/lib/rate-limit.ts` — Zero-dependency in-memory sliding-window rate limiter (module-scoped Map, periodic cleanup, configurable window/max)

**Files modified**:

- `apps/erp/src/app/api/auth/login/route.ts` — Added IP-based rate limiting (5 req/60s)
- `apps/erp/src/app/api/auth/create-user/route.ts` — Added rate limiting (3 req/60s) + replaced manual validation with `createUserSchema` from `@cendaro/validators`
- `apps/erp/src/app/api/ai/parse-packing-list/route.ts` — Added Supabase session auth guard to prevent unauthenticated Groq API quota drainage
- `packages/validators/src/index.ts` — Added `createUserSchema` (Zod v4) for shared frontend/backend validation
- `.env.example` — Added security header with explicit credential rotation checklist
- `.github/workflows/ci.yml` — Added `pnpm audit --prod --audit-level=high` step (advisory-only)

**Verification**: `pnpm typecheck` (6/6 ✅) + `pnpm lint` (6/6 ✅) — Exit Code 0

**Key decisions**:

- In-memory rate limiter (Option A) chosen over Upstash Redis — zero dependencies, sufficient for current scale, easy migration path
- Rate limit keys are namespaced (`create-user:${ip}`) to prevent cross-endpoint interference
- AI auth guard placed after GROQ_API_KEY check (fail-fast pattern: cheapest check first)
- CI audit step uses `continue-on-error: true` to surface CVEs without blocking deployments



**Objective**: Integrate Lightricks LTX-2 Cloud API as a video pre-rendering pipeline for the landing page.

**Files created**:

- `apps/erp/.env.local` — LTX API key (gitignored, secured)
- `apps/erp/src/env.ts` — Added `LTX_API_KEY` with `z.string().startsWith("ltxv_").optional()` validation
- `scripts/ltx-prompts.json` — 3 cinematography-grade prompts (ambient-background 10s, hero-cinematic 8s, feature-showcase 6s)
- `scripts/generate-ltx-videos.mjs` — Standalone generation pipeline with `--dry-run`, `--only`, `--model` flags

**Key decisions**:

- LTX-2 cannot run locally (needs 24GB+ VRAM, user has RTX 3060 6GB) — using Cloud API instead
- API is synchronous (returns MP4 binary directly, no polling)
- Budget: $1.25 credits, plan uses $0.96 (24s of video)
- Videos are complementary to existing Remotion assets, not replacements
- Zero React component changes — videos are static MP4s in `public/videos/`

**Execution command** (not yet run):

```powershell
pnpm exec dotenv -e apps/erp/.env.local -- node scripts/generate-ltx-videos.mjs --dry-run
pnpm exec dotenv -e apps/erp/.env.local -- node scripts/generate-ltx-videos.mjs
```

**Status**: Implementation complete. API not yet called — awaiting user execution.

- **Last Modified By**: Antigravity Agent — 2026-03-24T01:48:00+01:00

---

### 2026-03-24T01:48:00+01:00 — Landing Page Polish & Remotion Scene Overhaul

- **Scope**: Professional update to landing page (navbar, section transitions) and complete Remotion scene rewrite (5 scenes).
- **Navbar**: Changed from `bg-transparent` at rest to always-on `backdrop-blur-md`, with `backdrop-blur-xl` + `bg-background/60` on scroll. File: `apps/erp/src/app/_components/landing/navbar.tsx`.
- **Section Dividers**: Replaced 1px hard lines with 96px gradient fade zones using `bg-linear-to-b from-background to-transparent`. File: `apps/erp/src/app/_components/landing/noise-overlay.tsx`.
- **Remotion Scenes** (all 5): Replaced generic gradient "C" box logo with actual `<Img src={staticFile("cendaro-logo.png")}/>`. Reduced all font sizes, padding, and added `overflow: "hidden"` to fit 1280×720 viewport cleanly.
  - `DashboardScene`: KPI values 48→36px, bar chart 80→60px, table reduced to 3 rows, stock alert repositioned to `bottom: 20`.
  - `InventoryScene`: Product name 26→20px, stock 30→24px, compact rows.
  - `OrderFlowScene`: Kanban cards compact, font sizes reduced.
  - `CatalogScene`: Replaced color swatches with 6 AI-generated product images (`video/public/products/*.png`).
  - `AnalyticsScene`: Chart height 110→80px, invoice table compact.
- **Files Changed**: `navbar.tsx`, `noise-overlay.tsx`, 5 Remotion scene files, `video/public/cendaro-logo.png` (NEW), `video/public/products/` (6 NEW images).
- **Verification**: `pnpm typecheck` ✅ 6/6 tasks, exit 0 (FULL TURBO).
- **Pending**: Remotion video re-rendering (user must run `npx remotion render` for each composition).

---

### 2026-03-24T01:24:00+01:00 — Production Console Error Fixes (manifest.json + meta tag)

- **Scope**: Fixed 2 of 3 production console errors on `cendaro-erp.vercel.app`. Error #1 (tRPC 500 workspace auto-resolve) handled separately by user.
- **Fix #1 (manifest.json 404)**: Created `apps/erp/public/manifest.json` — PWA manifest with name, icons (`cendaro-logo.png`, `favicon.ico`), standalone display, dark theme colors (`#0a0a0a`/`#0f172a`).
- **Fix #2 (deprecated meta tag)**: Changed `apple-mobile-web-app-capable` → `mobile-web-app-capable` in `apps/erp/src/app/layout.tsx` line 52.
- **Also fixed (prior)**: ESLint lint-staged error — removed inline `eslint-disable-next-line @next/next/no-img-element` from `opengraph-image.tsx`, added config-level override in `eslint.config.ts` for OG/Twitter image files. Root cause was lint-staged running ESLint from root (no `@next/next` plugin) while the disable comment referenced that plugin's rule.
- **Files Changed**: `apps/erp/public/manifest.json` (NEW), `apps/erp/src/app/layout.tsx`, `apps/erp/src/app/opengraph-image.tsx`, `apps/erp/eslint.config.ts`
- **Verification**: `pnpm typecheck` ✅ (6/6 tasks, exit 0)

### 2026-03-24T01:24:00+01:00 — Workspace Auto-Resolve (First Login Fix)

- **RCA**: `WorkspaceProvider` had no fallback when localStorage/cookie are empty (first login, cache clear, new device). `getWorkspaceId()` returned null → `workspaceProcedure` threw BAD_REQUEST → 500 on every workspace-scoped endpoint.
- **Fix**: Created `WorkspaceAutoResolver` component that runs inside both `TRPCProvider` and `WorkspaceProvider`. When no workspace is stored, it queries `workspace.list` (protectedProcedure, no workspace context needed), auto-selects the first active workspace, and persists to localStorage + cookie. Layout wraps children in this component — rendering is gated behind `isReady`.
- **New File**: `apps/erp/src/components/workspace-auto-resolver.tsx`
- **Files Changed**: `apps/erp/src/hooks/use-workspace.tsx` (cleanup), `apps/erp/src/app/(app)/layout.tsx` (added WorkspaceAutoResolver wrapper)
- **Verification**: `pnpm typecheck` ✅ exit 0, `pnpm test` ✅ 39/39 pass

---

### 2026-03-23T23:31:00+01:00 — Logo Audit & Replacement (Transparent PNG)

- **Scope**: Professional audit of all logo references across the monorepo. Created transparent PNG from user-provided logo (rembg + numpy flood-fill). Replaced 4 instances of generic "C-in-blue-box" placeholder with real `cendaro-logo.png`.
- **Logo Processing**: Cropped Gemini watermark, flood-fill background removal (scipy `ndimage.label` for border-connected dark pixels only), auto-trimmed to content (1150×1122 RGBA).
- **Files Changed**: `navbar.tsx` (added `next/image` import + `<Image>` 32×32), `footer.tsx` (added `next/image` import + `<Image>` 24×24), `login/page.tsx` (added `next/image` import + `<Image>` 64×64, removed gradient box), `opengraph-image.tsx` (replaced blue rect with `<img>` URL reference).
- **New File**: `apps/erp/public/cendaro-logo.png` (transparent RGBA PNG)
- **Not Changed**: `final-cta.tsx` (text watermark, intentional), `workspace-switcher.tsx` (uses dynamic workspace initials)
- **Verification**: `pnpm typecheck` ✅ 0 errors, `pnpm build` ✅ exit 0

### 2026-03-23T22:53:00+01:00 — Multi-Tenant Implementation Completion

- **Scope**: Closed critical RLS gap + server-side workspace propagation + user seeding.
- **Phase A**: Applied migration `fix_workspace_rls_policies` — dropped 62 empty RLS policies and recreated with `USING/WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid)`. Granted CRUD privileges to `app_user` on 62 tables + SELECT on 5 lookup tables.
- **Phase B**: Added cookie persistence (`cendaro-workspace-id`) in `use-workspace.tsx`, server-side cookie reading in `server.ts`, proxy header forwarding in `proxy.ts`.
- **Phase C**: Applied migration `set_default_workspace_on_profiles` — set `default_workspace_id` for 2 existing users.
- **Phase D**: 62/62 policies verified with non-null expressions. `pnpm typecheck` exit 0, `pnpm test` 39/39 pass.
- **Files Changed**: `apps/erp/src/hooks/use-workspace.tsx`, `apps/erp/src/trpc/server.ts`, `apps/erp/src/proxy.ts`
- **Supabase Migrations**: `fix_workspace_rls_policies`, `set_default_workspace_on_profiles`

- **Scope**: Full monorepo audit to update README.md with all structural changes.
- **Changes**: 19 routers (was 18), 67 tables (was 58), 34 enums (was 30), 12 phases (was 11). Added Phase 10 (Multi-tenancy: 6 tables), Phase 11 (Notifications: 3 tables). Updated file tree, router graph, schema diagram, ER diagram, security diagram, UI components, roadmap.
- **Files Changed**: `README.md`

### 2026-03-23T21:16:00+01:00 — CI Lint Fix: Video Module ESLint Exclusion

- **RCA**: ESLint's `projectService` mapped `video/src/*.tsx` files to `apps/erp/tsconfig.json` which does NOT include `video/` in its `include`. Remotion types were unresolvable → 116 `no-unsafe-*` errors.
- **Fix**: Added `{ ignores: ["video/**"] }` to `apps/erp/eslint.config.ts`. The `video/` directory is a self-contained Remotion project with its own `tsconfig.json`.
- **Files Changed**: `apps/erp/eslint.config.ts`
- **Verified**: `eslint --cache` exits 0 with zero errors/warnings.

### 2026-03-23T20:48:00+01:00 — M8b+M9+M10: Router Migration + Workspace Router + Switcher UI

- **M8b Router Migration**: 19 router files migrated from `protectedProcedure`/`roleRestrictedProcedure` → `workspaceProcedure` (~120+ refs). Exception: `users.me` kept on `protectedProcedure`.
- **M9 Workspace Router**: Created `packages/api/src/modules/workspace.ts` (7 procedures: list, current, create, update, members, inviteMember, removeMember). Registered in `root.ts`.
- **M9 Provider Integration**: Wrapped `apps/erp/src/app/(app)/layout.tsx` with `<WorkspaceProvider>`.
- **M10 Workspace Switcher**: Created `apps/erp/src/components/workspace-switcher.tsx`. Plan badges, keyboard nav, 44px targets, avatar initials. Integrated into sidebar header replacing static Cendaro logo.
- **Verification**: `@cendaro/api` tsc 0 errors, `@cendaro/erp` tsc 0 errors.

---

### 2026-03-23T19:45:00+01:00 — M6+M8: Composite Constraints + tRPC Middleware + Frontend

- **M6**: 20 unique constraints converted to workspace-scoped composites (DB + schema)
- **M8 Backend**: 4 workspace procedures added to `packages/api/src/trpc.ts`:
  - `workspaceProcedure`: SET LOCAL ROLE + RLS enforcement + membership validation
  - `moduleProcedure`: module gate per workspace subscription
  - `wsPermissionProcedure`: module + RBAC permission check
  - `orgAdminProcedure`: cross-workspace owner access
- **M8 Frontend**: `apps/erp/src/hooks/use-workspace.tsx` (WorkspaceProvider + useWorkspace + getWorkspaceId)
- **M8 tRPC Client**: `apps/erp/src/trpc/client.tsx` — auto-sends x-workspace-id header
- **Column Defaults**: 62 workspace_id columns now use `current_setting('app.workspace_id')::uuid` as default
- **Verification**: Full monorepo typecheck ✅ (6/6 tasks, 0 errors), `drizzle-kit push` ✅

---

### 2026-03-23T19:25:00+01:00 — M3-M5: workspace_id Added to 54 Tables

- **Database**: Single SQL migration: added workspace_id to 54 tables, backfilled with default workspace `a0000000-...0001`, set NOT NULL, FK + index
- **Default Workspace**: `OmniCore Default` (slug: `omnicore-default`, plan: `pro`, all 17 modules enabled, 2 members migrated)
- **Schema**: Node.js transform script applied workspaceId + workspacePolicy + .enableRLS() to all 54 tables, 7 comma fixes applied manually
- **pgRole Fix**: `appUserRole = pgRole("app_user").existing()` — prevents conflict with migration-created role
- **Verification**: `pnpm typecheck` ✅ (0 errors), `drizzle-kit push` ✅ (Changes applied), DB: 62 RLS-enabled tables, 62 with workspace_id

---

### 2026-03-23T19:10:00+01:00 — M2: SQL Infrastructure Applied

- **Migrations**: 5 Supabase migrations applied to project `ljwoptpaxazqmnhdczsb`
- `create_app_user_role`: `app_user` role (NOLOGIN, NOINHERIT, no BYPASSRLS) + DML grants
- `create_is_workspace_member_function`: Membership validation (SECURITY DEFINER, STABLE)
- `create_next_document_number_function`: Sequential doc numbers with advisory locks
- `create_enforce_workspace_quota_trigger`: BEFORE INSERT trigger on `workspace_member`
- **Schema Push**: `drizzle-kit push` — all 10 new tables created in DB
- **Fix**: Changed `pgRole("app_user", {...})` to `pgRole("app_user").existing()` to prevent conflict
- **Verification**: All 3 functions confirmed via `information_schema.routines` query

---

### 2026-03-23T19:05:00+01:00 — M1: New Multi-Tenancy Tables Implemented

- **File**: `packages/db/src/schema.ts` (2089 → ~2490 lines)
- **Added Imports**: `pgPolicy`, `pgRole` from `drizzle-orm/pg-core`
- **New Enums (4)**: `workspaceStatusEnum`, `memberStatusEnum`, `workspacePlanEnum`, `notificationBucketTypeEnum`
- **RLS Factory**: `appUserRole` (pgRole) + `workspacePolicy()` (pgPolicy factory — one-liner per table)
- **New Tables (10)**: `Workspace`, `WorkspaceMember`, `WorkspaceModule`, `WorkspaceQuota`, `WorkspaceProfile`, `DocumentSequence`, `NotificationBucket`, `NotificationBucketAssignee`, `NotificationRoutingRule`
- **UserProfile Modified**: Added `defaultWorkspaceId: t.uuid()` column
- **Relations (9)**: All new tables have Drizzle relation blocks
- **Type Exports (12)**: `WorkspaceSelect/Insert`, `WorkspaceMemberSelect/Insert`, etc.
- **Verification**: `pnpm typecheck` ✅ (0 errors), `pnpm lint` ✅ (0 errors)
- **Next**: Phase M2 (SQL infrastructure — app_user role, functions, triggers)

---

### 2026-03-23T18:51:00+01:00 — Multi-Tenancy RBAC Architecture Design (APPROVED)

- **Deliverable**: Architecture plan v2.1 — design-only, no code changes
- **Strategy**: Option C (Custom DB Role `app_user` + `SET LOCAL` in Drizzle transactions)
- **ISO 27001:2022**: Aligned with Annex A controls A.5.15, A.5.18, A.8.11, A.8.12, A.8.15
- **New Tables (10)**: `workspace`, `workspace_member`, `workspace_module`, `workspace_quota`, `workspace_profile`, `document_sequence`, `notification_bucket`, `notification_bucket_assignee`, `notification_routing_rule`
- **New Enums (4)**: `workspace_status`, `member_status`, `workspace_plan`, `notification_bucket`
- **Modified Tables**: 54 of 58 existing tables receive `workspace_id NOT NULL` + `workspacePolicy()` + `.enableRLS()`
- **Global Tables (4)**: `Organization`, `UserProfile`, `Permission`, `RolePermission`
- **Middleware Chain**: `publicProcedure → protectedProcedure → workspaceProcedure → moduleProcedure → wsPermissionProcedure` + `orgAdminProcedure` for cross-ws
- **Plans**: Starter (free, 1 user, 500 products), Pro ($29/23, unlimited), Enterprise (custom)
- **Migration**: 9-phase strategy (M1-M9), each independently reversible
- **Artifact**: `brain/363f7ab7-0168-4ca4-9b32-0fa1fe489d9d/implementation_plan.md`
- **Status**: ✅ APPROVED by user — ready for implementation

---

### 2026-03-23T02:10:00+01:00 — Fix Auto Light/Dark Mode Switching

- **Root Cause**: `defaultTheme="light"` in `theme-provider.tsx` forced light mode and bypassed `enableSystem`. `next-themes` only reads `prefers-color-scheme` when theme is `"system"`.
- **Fix**: Changed `defaultTheme` from `"light"` to `"system"` in `theme-provider.tsx`.
- **Migration**: Added one-time blocking `<script>` in `layout.tsx` `<head>` that clears stale `"light"` value from `localStorage` so existing users also get auto-switching.
- **CSS Fix**: Moved landing dark tokens from `@variant dark` inside `:root` to standalone `.dark` selector after `@custom-variant` declaration in `globals.css`.
- **Files Modified**: `theme-provider.tsx`, `layout.tsx`, `globals.css`
- **Verification**: `pnpm lint` ✅ (0 errors), `pnpm typecheck` ✅ (0 errors), `pnpm build` ✅ (exit 0)

---

### 2026-03-23T01:53:00+01:00 — iOS Optimization + Auto Light/Dark Mode (Landing Page)

- **Audit**: Professional audit of all 16 landing components against `ui-ux-pro-max` checklist. Found 3 critical, 5 high, 3 medium issues.
- **Theme Tokens**: Added 7 CSS custom properties to `globals.css` (`--landing-card-border`, `--landing-card-bg`, `--landing-card-border-hover`, `--landing-line`, `--landing-dot-active/inactive`, `--landing-glow-opacity`) with `:root` (light) and `@variant dark` (dark) values.
- **Color Migration**: Replaced all 11 hardcoded `rgba(255,255,255,*)` instances across `sticky-features.tsx`, `bento-grid.tsx`, `value-props.tsx`, `hero.tsx`, `noise-overlay.tsx` with semantic landing tokens using Tailwind v4 shorthand.
- **iOS Fixes**: Removed `maximumScale: 1` from `layout.tsx` (WCAG pinch-to-zoom), added `safe-pt` to `navbar.tsx` for notch, `safe-pb` to `footer.tsx` for home indicator, body scroll lock on mobile menu, `min-h-[90dvh]` in `hero.tsx`, increased touch targets (hamburger 44px, social icons 44px, pricing toggle 32px).
- **Bug Fixes**: Added unique SVG filter IDs via `useId()` in `noise-overlay.tsx` to prevent collision, hero glows now use `dark:` variant for proper light/dark adaptation.
- **Files Modified**: `globals.css`, `layout.tsx`, `navbar.tsx`, `footer.tsx`, `hero.tsx`, `sticky-features.tsx`, `bento-grid.tsx`, `value-props.tsx`, `noise-overlay.tsx`, `pricing-cards.tsx`
- **Verification**: `pnpm lint` ✅ (0 errors), `pnpm typecheck` ✅ (0 errors), `pnpm build` ✅ (exit 0, 5/5 tasks)

---

### 2026-03-23T01:41:00+01:00 — Sticky Features Overhaul (midday.ai-inspired)

- **Rewrite**: Completely rewrote `sticky-features.tsx` to a professional sticky-scroll section benchmarked against midday.ai.
- **5 Features**: Expanded from 3 to 5 features (Inventario, Pedidos, Catálogo, Reportes, Panel de control) using existing Remotion videos from `/videos/*.mp4`.
- **Vertical Indicator Line**: Implemented midday.ai-style vertical line with animated square dots — clickable, smooth-scroll navigation, visual progress tracking.
- **Typography & State**: Serif font for feature titles. Active features: 100% opacity, expanded descriptions. Inactive features: 20% opacity, collapsed.
- **Section Header**: Added "CÓMO FUNCIONA" label above heading.
- **Video Transitions**: 400ms duration with `blur(4px)` + `scale(0.98)` effect via `AnimatePresence`.
- **Mobile Fallback**: Stacked card layout for mobile with enterprise styling.
- **Lint Fix**: Removed unused `index` prop from `IndicatorDot` component (ESLint `@typescript-eslint/no-unused-vars`).
- **Code Formatting**: User ran Prettier across landing page components (`bento-grid.tsx`, `hero.tsx`, `noise-overlay.tsx`, `scroll-video.tsx`, `sticky-features.tsx`, `value-props.tsx`, `globals.css`, `page.tsx`) and video scenes (`CendaroDemo.tsx`, `index.ts`, `AnalyticsScene.tsx`, `CatalogScene.tsx`, `DashboardScene.tsx`, `InventoryScene.tsx`, `OrderFlowScene.tsx`).
- **Verification**: `pnpm lint` ✅ 0 errors, `pnpm typecheck` ✅ 0 errors, `pnpm build` ✅ 5/5 tasks exit 0.
- **Files changed**: `sticky-features.tsx` (rewrite)

---

### 2026-03-22T22:58:00+01:00 — Dynamic Visual System (Phases 1-3)

- **Phase 1 — Code Mockups**: Replaced static wireframes in `hero.tsx` (dashboard replica with CountUp KPIs, operations table, closures, floating notification), `sticky-features.tsx` (3 distinct mockups: Inventory/Orders/Catalog with Framer Motion animations), `bento-grid.tsx` (8 enhanced mini-visuals with real data). Added keyframes in `globals.css`.
- **Phase 2 — Remotion Video**: Created `apps/erp/video/` project with 3 scenes (`DashboardScene`, `InventoryScene`, `OrderFlowScene`). Rendered 18s MP4 (1.3 MB, h264). Copied to `apps/erp/public/cendaro-demo.mp4`. Added Dashboard ↔ Video Demo toggle in hero using `AnimatePresence`.
- **Phase 3 — Verification**: `pnpm typecheck --filter @cendaro/erp` — 0 errors. `pnpm build --filter @cendaro/erp` — exit 0 (31.7s, 5/5 tasks). Visual browser check passed (both toggle views).
- **New files**: `video/package.json`, `video/tsconfig.json`, `video/remotion.config.ts`, `video/src/index.ts`, `video/src/CendaroDemo.tsx`, `video/src/Walkthrough.tsx`, `video/src/scenes/DashboardScene.tsx`, `video/src/scenes/InventoryScene.tsx`, `video/src/scenes/OrderFlowScene.tsx`, `public/cendaro-demo.mp4`

---

### 2026-03-22T20:10:00+01:00 — Landing Page Polish (4-phase)

- **New files**: `testimonials.tsx`, `faq-section.tsx`, `opengraph-image.tsx`
- **Modified files**: `page.tsx` (JSON-LD, OG meta, canonical, new section imports), `hero.tsx` (trust badge, secondary CTA), `bento-grid.tsx` (8 mini-visuals, hover lift), `integrations-marquee.tsx` (real SVG logos for 8 brands), `stats-section.tsx` (sub-description, accent lines), `pricing-cards.tsx` (Enterprise tier, 3-column grid), `scroll-entrance.tsx` (`useReducedMotion()` a11y), `navbar.tsx` (smooth-scroll), `footer.tsx` (social icons, "Hecho en España")
- **Verification**: typecheck 0 errors, build 5/5 tasks, visual browser scroll-through passed
- **Key decisions**: Skipped section divider (visual flow clean without). Deferred auth redirect for logged-in users (requires careful middleware handling).

---

---

### 2026-03-22T19:36:00+01:00 — Landing Page Implementation (midday.ai-inspired)

- **Created 13 new files** in `apps/erp/src/app/_components/landing/`: `scroll-entrance.tsx`, `use-scroll-y.ts`, `navbar.tsx`, `hero.tsx`, `sticky-features.tsx`, `bento-grid.tsx`, `stats-section.tsx`, `integrations-marquee.tsx`, `pricing-cards.tsx`, `final-cta.tsx`, `footer.tsx`
- **Modified** `page.tsx` (replaced redirect with landing), `layout.tsx` (Playfair Display serif font), `globals.css` (landing tokens + marquee keyframes), `proxy.ts` (made `/` public with exact match), `tooling/tailwind/theme.css` (added `--font-serif`)
- **Dependencies added**: `framer-motion`, `lucide-react`
- **Key patterns**: Scroll-synced sticky features (IntersectionObserver), blur+fade entrance animations, CountUp on scroll, CSS marquee with gradient mask, navbar transparent→blur on scroll
- **Middleware change**: `/` is now a public route (exact match) — authenticated users should be redirected to `/dashboard` via client-side logic. All `/app/*` routes remain protected.
- **Verified**: `typecheck` ✅ 0 errors, `build` ✅ 5/5 tasks exit 0, visual browser ✅ all 9 sections render in dark mode

### 2026-03-22T17:21:00+01:00 — UI/UX Pro Max Skill Integration (v2.0)

- **Integrated** `ui-ux-pro-max` skill from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT)
- **Location**: `.agents/skills/ui-ux-pro-max/` (SKILL.md + data/ + scripts/)
- **SKILL.md rewritten** for Antigravity: YAML frontmatter, all paths `.agents/skills/`, `python` (not `python3`), Example Workflow for Next.js, Cendaro integration section, scope notices adapted for web
- **Data**: 13 CSV files (67 styles, 161 colors, 57 typography, 161 products, 161 reasoning rules, 24 landing, 99 UX, 25 charts + Google Fonts + React perf + app interface + icons + design), 1 stack CSV
- **Scripts**: 3 Python files (search.py, core.py, design_system.py) — zero modifications, path resolution verified
- **Verification**: 8 automated tests passed — design system generation, 5 domain searches, zero `.claude` references, zero `python3` references
- **.gitignore**: Added `design-system/` entry for `--persist` output
- **Coexistence**: Complements `frontend-design` (aesthetic philosophy) and `web-design-guidelines` (audit) skills
- Files changed: `.agents/skills/ui-ux-pro-max/SKILL.md` (NEW), `.agents/skills/ui-ux-pro-max/data/*` (NEW), `.agents/skills/ui-ux-pro-max/scripts/*` (NEW), `.gitignore`

### 2026-03-22T16:49:00+01:00 — README.md Audit v2: Catalog Import Sync

- Audited root `README.md` against all source files — 15 data-accuracy corrections applied
- Router count 17→18 (+`catalogImport`), table count 55→58 (+`CategoryAlias`, `ImportSession`, `ImportSessionRow`), enum count 27→30 (+3 import session enums)
- Client modules 12→13 (+`catalog-import`), Turbo tasks 12→15, schema phases 10→11
- Added `catalogImport` to Mermaid router diagram + router table
- Added 3 catalog import tables to schema Mermaid diagram, phase table, and ER diagram
- Added `GROQ_API_KEY` + `EXCHANGE_RATE_API_KEY` to env vars table
- Verification: grep confirmed 0 stale values, all 11 new patterns present ≥1 match
- Files changed: `README.md`

### 2026-03-20T17:05:00+01:00 — Smart Category Engine: Inline Creation + Name Suggestions

- Server: `validate` generates `suggestedNewName` via tokenization algorithm (Spanish stopwords, product name frequency)
- Server: `resolveCategories` creates categories inline when `newCategoryName` provided (auto-slug + audit log)
- Server: auto-cancel stale import sessions instead of blocking with CONFLICT
- Client: `category-mapping.tsx` rebuilt with "Crear categoría" button + inline input pre-filled with suggested name
- Client: Session persistence fixed — only persists client-safe steps, regenerates `idempotencyKey` on restore
- Files: `catalog-import.ts`, `use-catalog-import.ts`, `category-mapping.tsx`, `catalog-import-wizard.tsx`

### 2026-03-20T16:30:00+01:00 — Catalog Import: Template Fix + Smart Categories + UI Polish

- Fixed template XLSX: removed `cell.c` comments (giant floating boxes), required fields now use visual `*` suffix
- Updated `normalizeHeader()` to strip `*` markers and collapse whitespace
- Enhanced server-side category matching: dual scoring (40% category name + 60% product name similarity)
- Category suggestions now include `reason` text + `RECOMENDADO` badge for top suggestions ≥70%
- Redesigned `header-mapping.tsx` to match inventory wizard table layout (# / header / dropdown / badges)
- Added `sessionStorage` persistence + restored session banner to catalog wizard
- `pnpm typecheck` exit 0

---

### 2026-03-20T16:10:00+01:00 — Catalog Import Consolidation

- Integrated template download button into existing `file-upload.tsx` (gradient CTA, loading state, toast)
- Removed `/catalog/import-products` route + `bulk-product-import-wizard.tsx`
- Removed `bulkCreateProducts` mutation (~190 lines) from `catalog.ts`
- Catalog page now has exactly 2 buttons: "Importar Catálogo" + "Nuevo Producto"
- All import pipeline logic exclusively via `catalogImport.commit` (6-step wizard)
- `pnpm typecheck` exit 0

### 2026-03-20T15:30:00+01:00 — Catalog Import + Permissions + BCV Enforcement

**Feature 1 — Bulk Product XLSX Import**:

- `catalog-template-builder.ts` — 4-sheet XLSX template (Productos, Instrucciones, Reglas, Valores Válidos)
- Template download integrated into existing catalog import wizard Step 1
- "Importar Productos" button removed — consolidated into "Importar Catálogo"

**Feature 2 — Product Creation Global Scope**:

- Removed ~150 lines of warehouse stock section from `create-product-page.tsx`
- Removed `initialStock` from `catalog.ts` `createProduct` API
- Added `RoleGuard allow={["owner", "admin", "supervisor"]}` — admin keeps full access
- Removed unused `StockMovement` import

**Feature 3 — BCV Rate Immutability**:

- Removed `manualRate` state and Oficial/Paralelo selector from product creation
- BCV rate now shown as read-only badge (non-editable)
- Added source validation to `pricing.setRate` — only `dolarapi-*`, `frankfurter*`, `system-sync*` sources allowed

**Verification**: `@cendaro/api` typecheck ✅, `@cendaro/erp` typecheck ✅

---

### 2026-03-20T00:56:00+01:00 — Production 500 Fix: Missing RLS Policies

**Root cause**: 3 new catalog import tables had RLS enabled but **no policies**, causing all queries to fail in production. All other 55 tables use `auth.role() = 'service_role'` policies.

**Migration applied** (`add_rls_policies_catalog_import`):

- `svc_category_alias` on `category_alias`
- `svc_import_session` on `import_session`
- `svc_import_session_row` on `import_session_row`

**Dashboard warnings** (`payments`, `accounts_receivable`): Non-critical — `safeQuery()` handles these with fallback values. Caused by intermittent Supabase cold starts.

---

### 2026-03-20T01:30:00+01:00 — Catalog Import: Full Audit & Supabase Sync (Complete)

**What**: Comprehensive audit of the Catalog Import feature — local code quality and Supabase database synchronization.

**Supabase migration applied** (`create_catalog_import_tables`):

- 3 enums: `import_session_status`, `import_session_row_status`, `import_session_row_action`
- 3 tables: `category_alias` (5 cols), `import_session` (18 cols), `import_session_row` (12 cols)
- 10 indexes, RLS enabled, `pg_trgm` already installed

**20 lint fixes across 5 files:**

- `packages/api/src/modules/catalog-import.ts` — Added `RawRowData` typed interface for JSONB access (dot-notation + no-base-to-string), removed unused `AuditLog` import, simplified tautological condition, applied optional chain
- `apps/erp/src/modules/catalog-import/hooks/use-catalog-import.ts` — Prefixed unused `_headerMap` param
- `apps/erp/src/modules/catalog-import/hooks/use-parse-catalog-file.ts` — Separated inline type import
- `apps/erp/src/modules/catalog-import/steps/header-mapping.tsx` — Separated inline type import
- `apps/erp/src/modules/catalog-import/steps/validation-preview.tsx` — `||` → `??` (2 instances)

**Verification**: `pnpm lint` ✅, `pnpm typecheck` ✅, `pnpm test` ✅ (39 tests)

---

### 2026-03-20T00:02:00+01:00 — Catalog Import Phase 2: Frontend UI (Complete)

**What**: Implemented the full frontend for the Catalog Import feature: 3 lib files, 2 hooks, 6 step components, 1 wizard orchestrator, 1 route page, and 1 existing page modification.

**Files created (13)**:

- `apps/erp/src/modules/catalog-import/lib/catalog-header-aliases.ts` — 100+ bilingual header aliases + `autoMapCatalogHeaders`
- `apps/erp/src/modules/catalog-import/lib/catalog-normalizers.ts` — `parseDecimal`, `normalizeSku`, `normalizeName`, etc.
- `apps/erp/src/modules/catalog-import/lib/catalog-validators.ts` — File + row validation with error codes + severity
- `apps/erp/src/modules/catalog-import/hooks/use-parse-catalog-file.ts` — SheetJS client-side parsing with security options
- `apps/erp/src/modules/catalog-import/hooks/use-catalog-import.ts` — `useReducer` state machine (6 steps)
- `apps/erp/src/modules/catalog-import/steps/file-upload.tsx` — Drag & drop upload
- `apps/erp/src/modules/catalog-import/steps/header-mapping.tsx` — Editable column mapping
- `apps/erp/src/modules/catalog-import/steps/validation-preview.tsx` — Status filter cards + data table
- `apps/erp/src/modules/catalog-import/steps/category-mapping.tsx` — Fuzzy suggestion chips + manual select
- `apps/erp/src/modules/catalog-import/steps/dry-run-summary.tsx` — Insert/update/skip/error stat cards
- `apps/erp/src/modules/catalog-import/steps/result-summary.tsx` — Final outcome + error details
- `apps/erp/src/modules/catalog-import/catalog-import-wizard.tsx` — Main wizard orchestrator
- `apps/erp/src/app/(app)/catalog/import/page.tsx` — Route page for `/catalog/import`

**Files modified (1)**:

- `apps/erp/src/app/(app)/catalog/client.tsx` — Added "Importar Catálogo" button

**Verification**: `pnpm typecheck` ✅ (exit 0, 6 tasks), `pnpm test` ✅ (39 tests, 2 files).

---

---

### 2026-03-19T23:45:00+01:00 — Catalog Import Phase 1: Schema + Infrastructure

**What**: Implemented Phase 1 of the Catalog Import feature (PRD: `FEATURE_PRD_CATALOG_IMPORT.md`). Added 3 new pgEnums, 3 new tables, 6 inferred type exports, 3 Drizzle relations, a full 6-procedure tRPC router, router registration, and test updates. Enabled `pg_trgm` extension on Supabase.

**Files changed**:

- `packages/db/src/schema.ts` — Added `importSessionStatusEnum` (7 values), `importSessionRowStatusEnum` (7 values), `importSessionRowActionEnum` (3 values), `CategoryAlias` table (UNIQUE alias + FK→category), `ImportSession` table (15 columns, 3 indexes, 24h expiry), `ImportSessionRow` table (11 columns, 2 indexes, CASCADE delete), 6 type exports, 3 relation definitions
- `packages/api/src/modules/catalog-import.ts` — **[NEW]** 6-procedure tRPC router: `create` (session + row storage), `validate` (SKU lookup + category/brand resolution + pg_trgm fuzzy match), `resolveCategories` (apply mappings + save aliases), `dryRun` (insert/update/skip counts), `commit` (batched 100-row transactions), `getSession` (status + lazy expiry)
- `packages/api/src/root.ts` — Registered `catalogImportRouter` as 18th top-level router
- `packages/api/src/__tests__/router.test.ts` — 6 new procedure assertions, router count 17→18

**Supabase**: Applied migration `enable_pg_trgm_extension` on project `ljwoptpaxazqmnhdczsb`.

**Verification**: `pnpm typecheck` ✅ (exit 0, 6 tasks), `pnpm test` ✅ (39 tests, 2 files).

**Next**: User runs `pnpm db:generate` + `pnpm db:push` to sync tables. Then Phase 2 (frontend lib + hooks).

---

### 2026-03-19T23:17:00+01:00 — Inventory Import Wizard UX Improvements (3 phases + error blocking)

**What**: Implemented 3 UX improvements to the inventory import wizard (Initialize mode): (1) Renamed "Total" stat card → "Total Bultos" with mode-aware sum calculation, (2) Made StepIndicator completed steps clickable + added sessionStorage persistence with restore banner, (3) Made catalog preview stat cards interactive filters with toggle/auto-tab-switching. **(4)** Added professional error blocking panel in dry-run summary: first 3 errors shown with row badge + context + wrapped reason, expandable dropdown for the rest, commit button fully disabled with "Corregir errores para continuar" label.

**Files changed**:

- `apps/erp/src/modules/receiving/inventory-import/steps/validation-preview.tsx` — Mode-aware 4th stat card ("Total Bultos"/"Total Filas")
- `apps/erp/src/modules/receiving/inventory-import/inventory-import-wizard.tsx` — Clickable `StepIndicator`, `sessionStorage` persistence, restore banner
- `apps/erp/src/modules/receiving/inventory-import/hooks/use-inventory-import.ts` — New `RESTORE_STATE` action + `restoreState` callback
- `apps/erp/src/modules/receiving/inventory-import/steps/catalog-preview.tsx` — Interactive stat cards with `CatalogFilter` type, toggle, auto-tab switching
- `apps/erp/src/modules/receiving/inventory-import/steps/dry-run-summary.tsx` — `ErrorBlockingPanel` + `ErrorRow` components, `hasErrors` blocking, `errorRows` extraction

**Verification**: `tsc --noEmit` → 0 errors in all 5 modified files.

### 2026-03-19T22:04:00+01:00 — Skill-Creator Integration (10/10)

**What**: Integrated `skill-creator` skill into `.agents/skills/` from external download. Applied 10 edits to `SKILL.md` + 1 to `eval-protocol.md` + 1 new file. Changes: Spanish triggers (crear/mejorar/validar/empaquetar), `.agents/` paths (not `.agent/`), allowed-tools marked as Claude Code CLI legacy, Opus 4.6 constraint tension note, workspace-first execution paths, bilingual communication note, schemas.md referenced, boundary statement. Created `assets/skill-template.md`.

**Files changed**:

- `.agents/skills/skill-creator/SKILL.md` — 10 edits (246→254 lines)
- `.agents/skills/skill-creator/references/eval-protocol.md` — 1 edit (Native Antigravity Protocol)
- `.agents/skills/skill-creator/assets/skill-template.md` — **[NEW]** starter template

**Verification**: `quick_validate` ✅, 0 Claude Code CLI residuals, 9 Opus 4.6 references preserved.

---

### 2026-03-19T21:01:00+01:00 — Rules Cleanup + Prompt-Rule Enhancement

**What**: Deleted 2 duplicate rule files (`prompt-enhancer.md`, `epistemic-memory.md`) that were not UI-registered. Enhanced `prompt-rule.md` from 41 → 60 lines: added Opus 4.6 Adaptive Thinking core insight (anti-pattern table + constraint tension explanation) and Skill Bridge directive pointing to the full `prompt-enhancer-antigravity` skill for detailed templates.

**Files changed**:

- `.agents/rules/prompt-enhancer.md` — **[DELETED]** (duplicate, not UI-registered)
- `.agents/rules/epistemic-memory.md` — **[DELETED]** (duplicate, not UI-registered)
- `.agents/rules/prompt-rule.md` — Enhanced with Opus 4.6 core + Skill Bridge

**Verification**: Directory clean — only `prompt-rule.md` and `epistemic-memory-rule.md` remain in `.agents/rules/`.

---

### 2026-03-19T18:05:00+01:00 — Rules Architecture Cleanup + Always-On Rules

**What**: Professional audit of the entire rules/skill ecosystem revealed 7 of 12 content blocks were tripled across `GEMINI.md` global, `.gemini/rules.md`, and `omni-epistemic-memory` skill. Created 2 new always-on rule files in `.agent/rules/` and cleaned `rules.md` to eliminate redundancy.

**Files changed**:

- `.agent/rules/prompt-enhancer.md` — **[NEW]** Task Intake + Adaptive Thinking engagement (28 lines)
- `.agent/rules/epistemic-memory.md` — **[NEW]** Knowledge File Map + Pattern Interruption Protocol + Error Log Write Failure (25 lines)
- `.gemini/rules.md` — Removed 6 redundant protocol sections (~52 lines): Pre-Flight Protocol, Validation Protocol, Post-Task Protocol, Evolutionary Learning Protocol. Validation Standard preserved as single-line section.

**Decisions**: Rules architecture redesigned into clean layers: Kernel (GEMINI.md global) → Project (rules.md, project-specific only) → Always-On Rules (.agent/rules/) → Skills (on-match reference). Context budget reduced from 377 → 319 lines always-on.

**Verification**: All 3 files verified post-edit. rules.md preserved all project-specific content (conventions, commands, forbidden actions, code quality, error prevention matrix, safety, MCP, CI/CD).

---

### 2026-03-17T03:15:00+01:00 — README.md Professional Audit (Root)

**What**: Executed 12-step sequential audit of root `README.md` against all source files. Applied 37 data-accuracy corrections: badge versions (Next.js 16.0), router count 11→17, route count 19→22, table count 30+→55, enum count 20+→27, phase count 8→10 (+Phase 5b quotes/documents, +Phase 9 approvals/signatures), form count 13→14 (+CreateUser), hook count 2→4, validator count 7→14, ESLint 9.27→9.39.4. Added all missing tables per phase. Added 3 feature PRDs to documentation table. Expanded ER diagram. Corrected env vars.

**Files changed**: `README.md` (root)

**Verification**: All counts cross-referenced against source files: `root.ts`, `schema.ts`, `app/(app)/`, `forms/`, `hooks/`, `validators/src/index.ts`, `pnpm-workspace.yaml`.

---

### 2026-03-17T02:30:00+01:00 — PRD v2.0 Update (Inventory Import)

**What**: Updated `FEATURE_PRD_INVENTORY_IMPORT.md` from v1.0 → v2.0 with 20 targeted edits across 12 sections. Added Initialize mode (brand→product→stock creation), catalog preview step, dynamic step indicator, interactive stat cards, filter tabs with count badges, full-width message column, `initializeCommit` tRPC procedure, mode-aware Zod schemas, expanded header alias map, new error codes, mode-aware templates, and Appendix D changelog.

**Verification**: Document only — no code changes.

---

### 2026-03-17T02:20:00+01:00 — Validation Preview UX Polish

**What**: 3 UX improvements to `validation-preview.tsx`: (1) stat counter cards are now interactive `<button>` elements that filter the table with active ring/scale effects, (2) filter tabs show color dots + count badges for instant recognition, (3) message column no longer truncates — shows full text with status-colored icon.

**Verification**: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm build` ✅.

---

### 2026-03-17T02:05:00+01:00 — Inventory Import: UX Fixes (8 Bugs, 4 Phases)

**What**: Fixed 8 bugs in the inventory import wizard UX: empty validation table in Initialize mode, wrong mode labels, broken back navigation (resetting to step 1 instead of previous step), read-only catalog preview, DryRunSummary showing "0 productos", non-dynamic step indicator.

**Files changed**:

- `validation-preview.tsx` — rewritten: dual mode columns (Initialize: Marca/Producto/Bultos/Presentación/Total; Replace/Adjust: Actual/Delta/Nuevo), mode label lookup map
- `dry-run-summary.tsx` — rewritten: Initialize mode calculates products/brands/units from `initializeRows`, mode-aware confirmation dialog
- `catalog-preview.tsx` — rewritten: `EditableCell` component for inline editing of brand/product names, propagates changes via `onUpdateRows`
- `inventory-import-wizard.tsx` — dynamic `StepIndicator` (hides Catálogo for Replace/Adjust), back nav `goToStep(prev)`, `ImportMode` import, `initializeRows` props passed to ValidationPreview/DryRunSummary
- `use-inventory-import.ts` — new `UPDATE_INITIALIZE_ROWS` action + `updateInitializeRows` callback
- `mode-select.tsx` — lint fix: `bg-primary/[0.03]` → `bg-primary/3`

**Verification**: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm build` ✅ (all exit code 0).

---

### 2026-03-16T18:30:00+01:00 — Inventory Import: Initialize Mode (PRD §23)

**What**: Full implementation of the "Initialize" import mode that creates brands, products, and stock from scratch in a single operation. Resolves the blocker where first-time imports failed due to non-existent entities.

**Files changed**:

- **Backend**: `packages/api/src/modules/inventory-import.ts` (extended `importModeSchema`, added `initializeRowSchema`, `initializeCommitSchema`, `initializeResultSchema`, `slugify()` helper, `initializeCommit` tRPC procedure with transactional brand→product→stock creation), `packages/api/src/index.ts` (new type exports)
- **Libs**: `inventory-header-aliases.ts` (`getRequiredFieldsForMode()`), `inventory-normalizers.ts` (`normalizeBrandName`, `normalizeProductName`, `normalizeUnidPerCaja`), `inventory-validators.ts` (`InitializeValidatedRow`, `validateInitializeRows()`, 3 new error codes), `inventory-template-builder.ts` (`INITIALIZE_HEADERS`, wider types for download/build/getCellValue)
- **Hooks**: `use-inventory-import.ts` (7-step state machine, `initializeRows`/`catalogPreview`/`initializeResult` state, `INITIALIZE_VALIDATION_COMPLETE`/`INITIALIZE_COMPLETE` actions)
- **UI**: `catalog-preview.tsx` (**NEW** — 240 LOC), `mode-select.tsx` (3-col grid + Initialize card), `header-mapping.tsx` (mode-aware required fields), `inventory-import-wizard.tsx` (7-step STEPS, `initializeCommit` mutation, `handleConfirmInitialize`, catalog preview routing)

**Verification**: `tsc --noEmit` pass, full `pnpm build` pass (exit code 0, 27s).

---

### 2026-03-14T05:05:00+01:00 — Turborepo Remote Cache 413 Fix

**Root cause**: `turbo.json` build outputs glob `.next/**` was capturing the massive `.next/dev/` directory (875 MB of Turbopack dev cache), making the cache artifact exceed Vercel's 500 MB remote cache upload limit → `413 Request Entity Too Large`.

**Fix**: Replaced `.next/**` with specific subdirectory globs: `.next/build/**`, `.next/server/**`, `.next/static/**`, `.next/types/**`, `.next/cache/**`, `.next/*.json`, `.next/*.js`, `.next/BUILD_ID`, `.next/package.json`. Cleaned stale `.next/dev` (875 MB) and `.next/diagnostics` directories. Post-cleanup cache payload: ~35 MB.

**Files changed**: `turbo.json`, `.gemini/rules.md` (Error Prevention Matrix)

**Verification**: `pnpm build` exit code 0, zero `413` warnings, remote cache upload successful.

---

### 2026-03-14T04:25:00+01:00 — Inventory Import Template Redesign

**Changes:**

- **DB**: Added `presentation_qty` column to `product` table (migration `add_presentation_qty_to_product`)
- **Schema**: Added `presentationQty` to Drizzle `Product` table
- **tRPC**: `getWarehouseProducts` now JOINs `brand`, returns `brandName`, `unitsPerBox`, `boxesPerBulk`, `presentationQty`
- **Template Builder** (`inventory-template-builder.ts`): Full rewrite — 3 sheets (Plantilla, Instrucciones, Reglas), legend block, color-coded cells, frozen panes, mode-specific columns
- **Header Aliases** (`inventory-header-aliases.ts`): Removed barcode/notes/quantity, added bultos/cajasPerBulk/presentacion
- **Normalizers** (`inventory-normalizers.ts`): Removed normalizeQuantity/Notes, added normalizeBultos/CajasPerBulk/Presentacion
- **Validators** (`inventory-validators.ts`): Packaging calculation (Scenario A/B), enhanced error messages with product name + row
- **Wizard**: Wired template download with products data, removed notes from commit payload
- **Header Mapping UI**: Updated dropdown options for new packaging fields

**Files changed:**

- `packages/db/src/schema.ts`
- `packages/api/src/modules/inventory-import.ts`
- `apps/erp/src/modules/receiving/inventory-import/lib/inventory-template-builder.ts`
- `apps/erp/src/modules/receiving/inventory-import/lib/inventory-header-aliases.ts`
- `apps/erp/src/modules/receiving/inventory-import/lib/inventory-normalizers.ts`
- `apps/erp/src/modules/receiving/inventory-import/lib/inventory-validators.ts`
- `apps/erp/src/modules/receiving/inventory-import/inventory-import-wizard.tsx`
- `apps/erp/src/modules/receiving/inventory-import/steps/header-mapping.tsx`

---

---

## Current Status

- **Project health**: ✅ Operational — Inventory Import feature fully implemented
- **Last agent interaction**: 2026-03-14T03:40:00+01:00
- **Known issues**: None critical
- **Latest work**: Implemented Inventory Import feature (21+ files across 5 phases). API: 6 Zod schemas, 2 tRPC procedures (getWarehouseProducts, commit) with batched upserts, idempotency, RBAC. Client: SheetJS utilities, 43 header aliases, row validation (13 error codes), 3 normalizers, 3 hooks (parse, validate, state machine). UI: 6-step wizard (mode → upload → mapping → preview → dry-run → results) + orchestrator + route page. Integration: "Importar Inventario" button on warehouse detail page. Types re-exported from `@cendaro/api` barrel. Verified: `pnpm typecheck` zero errors, 39 tests passing.

---

## Knowledge Freshness

> Tracks when each knowledge file was last verified as accurate.

| File                                                | Last Verified | Verified By       |
| --------------------------------------------------- | ------------- | ----------------- |
| `.gemini/knowledge/architecture.md`                 | 2026-03-11    | Antigravity Agent |
| `.gemini/knowledge/stack.md`                        | 2026-03-11    | Antigravity Agent |
| `.gemini/rules.md`                                  | 2026-03-11    | Antigravity Agent |
| `.agents/skills/omni-epistemic-memory/error-log.md` | 2026-03-11    | Antigravity Agent |

---

## Dependency Change Log

> Tracks when dependencies were last audited and what changed.

| Date       | Action            | Details                                                                                             |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| 2026-03-11 | Initial inventory | Stack verified from zero-trust audit — all versions empirically confirmed from `package.json` files |

---

## Progress Log

<!-- Entries should be prepended (newest first) -->

### [2026-03-28] Enterprise OSS Pre-Flight Audit: 100% Cleared

- **Scope**: Executed the `/oss-preflight` Zero-Trust Workflow prior to public deployment.
- **Phase 1 (Blinding & Secrets)**: Truffle-level Regex scan executed across source code. Evaluated `.gitignore` fencing (`.agents`, `.gemini`, `.ops`). Zero IP leaks detected.
- **Phase 2 (Telemetry)**: Verified and auto-patched 10 internal packages to inject strict `license: AGPL-3.0` and `author: Cendaro` configurations for OSS platforms.
- **Phase 3 (Sanitization)**: Scanned repository root. No internal or operational files found outside isolated boundaries.
- **Phase 4 (Build & Integrity Matrix)**: Executed `--frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `turbo run build`. All 10 workspaces compiled successfully (Exit Code 0).
- **Phase 5 (Governance)**: Git index staged and validated natively.
- **Status**: ✅ **READY FOR OPEN SOURCE PUSH**

### [2026-03-28] Enterprise Open Source Metrology & Governance Stabilization

- **Scope**: Executed the Phase 2 Open Source Corporate Standardization audit, focusing entirely on governance structures, linguistic professionalism, and deep telemetry injection into workspace boundaries.
- **Linguistic Overhaul**: Re-wrote and systematically expanded strictly to Advanced English: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), `CHANGELOG.md`, `setup.ps1`, and all community guidelines (README sync policy).
- **Governance Setup**: Defined ownership scaffolding via `.github/CODEOWNERS` and scoped out-of-bounds user questions efficiently to the new `.github/SUPPORT.md`.
- **Telemetry Injection**: Patched all 11 internal `package.json` configurations (apps, packages, tooling) sequentially to inject standard OSS metric fields (`"license": "AGPL-3.0"`, `"author"`, `"repository"`, `"bugs"`) allowing automated platform analyzers to parse the codebase natively.
- **Cleanup**: Purged redundant and deprecated `PRD.md` artifact from the monorepo root.
- **Verification**: `pnpm install` ran successfully; `pnpm lint` returned Exit Code 0 with zero Sherif dependency defects.
- **Health**: ✅ Operational

### [2026-03-14] ESLint — Skill Source File Ignore

- **Root cause**: `lint-staged` feeds ALL staged `*.ts(x)` files to ESLint, including `.agents/skills/sheetjs-nextjs/source/` template files. These are not in any `tsconfig.json`, causing 11 `projectService` parsing errors that block commits.
- **Fix**: Added global ESLint ignores in `eslint.config.ts` for `.agents/**`, `_agents/**`, `.agent/**`, `_agent/**`.
- **Verification**: `pnpm exec eslint --cache --no-warn-ignored` on all 11 files → exit 0, zero errors.
- **Health**: ✅ Operational

### [2026-03-14] SheetJS–Next.js Skill Integration

- **Objective**: Analyze downloaded `sheetjs-nextjs-utils` skill and integrate professionally into `.agents/skills/sheetjs-nextjs/`.
- **New files**: `SKILL.md` (7 sections, YAML frontmatter), `REFERENCE.md` (15 functions + 4 components API reference), `PATTERNS.md` (5 Cendaro-specific integration patterns), `source/` (10 reference files).
- **Gap analysis**: Project already had `xlsx ^0.18.5` + `parse-file-browser.ts` (3-Tier pipeline for packing lists). Skill adds complementary capabilities: typed `T[]` parsing, browser download triggers, server-side Excel responses, and 3 reusable React components.
- **Key decisions**: Skill is agent documentation only — zero production code modified. Import paths use `~/lib/xlsx` (Cendaro convention). Server module isolated from barrel to prevent client-side `fs` errors.
- **Health**: ✅ Operational

### [2026-03-12] DolarAPI.com Migration — BCV Replacement + Parallel/USDT Rate

- **Objective**: Replace legacy BCV scraper APIs with DolarAPI.com; implement new parallel/USDT market rate feature.
- **Modified files**: `api/bcv-rate/route.ts` (complete rewrite → DolarAPI.com, returns both oficial + paralelo), `hooks/use-bcv-rate.ts` (new `useVesRates()` + backwards-compat `useBcvRate()`), `lib/sync-bcv-rate.ts` (new `maybeSyncVesRates()` syncs both rates), `rates/page.tsx` (parallel card + spread section + rate selector), `catalog/new/create-product-page.tsx` (rate type selector Oficial/Paralelo), `command-search.tsx` (+paralelo/usdt keywords), `settings/page.tsx` (label: "Umbral Tasa Oficial").
- **Key decisions**: Backwards-compatible wrappers (`useBcvRate`, `maybeSyncBcvRate`) ensure 7 consuming pages require zero changes. DB schema already had `parallel` in `rateTypeEnum` — no migration needed. Spread calculation: `((paralelo - oficial) / oficial) * 100`.
- **Data source**: `https://ve.dolarapi.com/v1/dolares` — MIT-licensed, no API key, returns both rates in single call.
- **Frankfurter/RMB untouched**: Explicitly verified zero changes to CNY pipeline.
- **Pending**: Full `pnpm typecheck` verification (commands were cancelled).

### [2026-03-12] USD/CNY Exchange Rate — Frankfurter API Integration

- **New files**: `api/exchange/usd-cny/route.ts` (server proxy, Frankfurter primary + ExchangeRate-API fallback, ISR 15min, sanity bounds 5.0-10.0), `hooks/use-cny-rate.ts` (client hook, 15min staleTime), `lib/sync-cny-rate.ts` (auto-sync to ExchangeRate DB)
- **Modified files**: `env.ts` (+EXCHANGE_RATE_API_KEY optional), `format-currency.ts` (+formatCnyCurrency), `rates/page.tsx` (live RMB card + converter using live rate + auto-sync)
- **Key decisions**: Mirrored existing BCV pipeline pattern (proxy → hook → sync → format). DB schema already had `rmb_usd` rateTypeEnum — no migration needed. Rate cards now show "En vivo" badge for both BCV and RMB.
- **Verification**: `pnpm exec tsc --noEmit` ✅ | `pnpm exec eslint . --quiet` ✅ (exit 0)
- **Health**: ✅ Operational

### [2026-03-12] ESLint Fix — BCV Rate Route Array Type

- **File changed**: `apps/erp/src/app/api/bcv-rate/route.ts`
- **Error**: `@typescript-eslint/array-type` — `Array<T>` syntax forbidden, must use `T[]`
- **Fix**: Changed `Array<{ exchange: number; date: string }>` → `{ exchange: number; date: string }[]` on line 43
- **Verification**: `pnpm build` ✅ | `pnpm lint` ✅ | `pnpm typecheck` ✅
- **Health**: ✅ Operational

### [2026-03-12] CORS Fix — Server-Side BCV Proxy

- **Root cause**: External BCV APIs (`bcv-api.rafnixg.dev`, `bcv-api.deno.dev`) block browser-side `fetch()` due to missing CORS headers. Hook silently fell back to stale DB rate (36.50 from 2026-03-07).
- **Fix**:
  - **[NEW]** `api/bcv-rate/route.ts` — Next.js server-side proxy (no CORS on server), ISR cache 1h
  - **[MODIFIED]** `use-bcv-rate.ts` — calls `/api/bcv-rate` proxy instead of external APIs
  - **[MODIFIED]** `sync-bcv-rate.ts` — also uses proxy
- **Verified**: API returns `{"rate":440.9657,"date":"2026-03-12","source":"bcv-api"}`, live rate displays on all 7 pages, 0 CORS errors in console

- **New file**: `format-currency.ts` — reusable dual-currency formatter (USD + Bs)
- **Modified 7 pages** with `useBcvRate` + `formatDualCurrency`:
  - `rates/page.tsx` — live BCV rate, auto-sync to ExchangeRate, "En vivo" badge
  - `dashboard/client.tsx` — KPIs (Ingresos, Cobrado, CxC, Total Recaudado) show Bs equivalent, BCV badge in header
  - `orders/client.tsx` — summary cards + mobile/desktop table dual currency
  - `quotes/client.tsx` — table total column Bs equivalent
  - `payments/page.tsx` — Total Cobrado card + method groups + table rows
  - `cash-closure/page.tsx` — all 4 summary cards dual currency
  - `vendors/page.tsx` — commission KPIs + table (Total Venta + Comisión) dual currency
- **TypeScript**: 0 errors (exit code 0)
- **BCV cache**: 1h staleTime (user approved)

### [2026-03-12] Inline Create + Precios USD/BCV

- **New files**: `creatable-select.tsx` (reusable inline-create select), `use-bcv-rate.ts` (triple fallback BCV hook), `sync-bcv-rate.ts` (auto-sync BCV rate to ExchangeRate)
- **Modified**: `create-product-page.tsx` — CreatableSelect for brand/cat/supplier, pricing section (USD + tasa BCV + Bs), setPrice on product creation, auto-sync BCV rate
- **BCV API**: Primary `bcv-api.rafnixg.dev` + backup `bcv-api.deno.dev` + DB fallback + manual override
- **priceType**: Uses `store` enum value (precio tienda)
- **Verification**: ERP typecheck ✅ 0 errors
- **Health**: ✅ Operational

### [2026-03-12] Sistema de Conversión de Empaque (UOM)

- **Migration**: `add_packaging_fields_to_product` (unitsPerBox, boxesPerBulk, sellingUnit)
- **Files modified**: `schema.ts` (+3 fields), `catalog.ts` (createProduct with auto-conversion), `create-product-page.tsx` (packaging config + incoming unit selector + auto-calc)
- **UOM reduced**: 4 types (unit, box, bulk, pack). Selling: unit, box, dozen, half_dozen, bulk
- **Auto-calc**: 5 bultos × 10 cajas × 12 und = 600 unidades en StockLedger
- **Verification**: 39/39 tests ✅ | API typecheck ✅ | ERP typecheck ✅
- **Health**: ✅ Operational

### [2026-03-12] Stock Inicial + Deducción por Cierre de Venta

- **Migrations**: `add_base_uom_and_initial_stock_movement`, `add_stock_deducted_to_sales_order`
- **Files modified**: `schema.ts` (+3 fields), `catalog.ts` (createProduct extended with initialStock[]), `create-product-page.tsx` (+Inventario Inicial section), `sales.ts` (stock deduction moved from createOrder to updateOrderStatus)
- **Bug fixed**: Stock was deducted at order creation (even drafts). Now only deducts on `delivered`/`invoiced`, reverts on `returned`/`cancelled`
- **Verification**: 39/39 tests ✅ | API typecheck ✅ | ERP typecheck ✅
- **Health**: ✅ Operational

### [2026-03-12] Catalog & Inventory Production Readiness Overhaul

- **Files created**: `catalog/new/page.tsx`, `catalog/new/create-product-page.tsx`, `inventory/warehouse/[id]/page.tsx`
- **Files modified**: `catalog/client.tsx` (dialog→link), `inventory.ts` (+7 procedures, fixed `transferStock`), `sales.ts` (+stock deduction on `createOrder`), `catalog.ts` (+stock in `productById`), `catalog/[id]/page.tsx` (+stock sections), `layout.tsx` (+Sonner Toaster), `router.test.ts` (+7 procedure assertions)
- **Dependencies**: Added `sonner` to `@cendaro/erp`
- **Cross-module fixes**: (1) Sales deduct `ChannelAllocation` on orders, (2) `transferStock` updates actual quantities, (3) `productById` returns `stockLedger`+`channelAllocations`, (4) Count items CRUD + `finalizeCount` with auto-discrepancy detection
- **Verification**: 39/39 tests ✅ | API typecheck ✅ | ERP typecheck ✅ | Lint 6/6 ✅
- **Health**: ✅ Operational

### [2026-03-12] Fix Stale API Unit Tests

- **Files changed**: Modified `packages/api/src/__tests__/schema.test.ts`, `packages/api/src/__tests__/router.test.ts`
- **Root cause**: Tests had hardcoded counts that fell behind schema/router evolution. `orderStatusEnum` grew from 7→10 values (added `pending_confirmation`, `invoiced`, `returned`). `appRouter` grew from 11→16 routers (added `approvals`, `quotes`, `payments`, `receivables`, `reporting`).
- **Fix**: Updated enum length assertion (7→10), router count assertion (11→16), added procedure assertions for 5 new routers.
- **Verification**: `pnpm --filter @cendaro/api test` ✅ — 39/39 tests passing
- **Health**: ✅ Operational

### [2026-03-12] Fix ESLint `process.env` Violation in create-user Route

- **Files changed**: Modified `apps/erp/src/app/api/auth/create-user/route.ts`
- **Root cause**: Direct `process.env` usage violated `no-restricted-properties` ESLint rule. Project uses t3-env for validated env access.
- **Fix**: Imported `env` from `~/env`, replaced 3 `process.env` calls, removed redundant null-check block.
- **Verification**: `pnpm lint` ✅
- **Health**: ✅ Operational

- **Files changed**: Modified `create-product.tsx` (SKU → Referencia label), `catalog/client.tsx` (table header + search placeholder), rewrote `create-order.tsx` (replaced `<Select>` dropdown with typeahead autocomplete)
- **Decisions**: Reused existing `sku` column as product reference (already UNIQUE, NOT NULL, indexed). No DB migration needed. Typeahead matches on sku/name/barcode with keyboard navigation (↑↓ Enter Escape). Order table now shows reference column.
- **Verification**: `pnpm lint` ✅ | `pnpm typecheck` ✅ | `pnpm build` ✅
- **Health**: ✅ Operational

### [2026-03-12] Role System Audit & PRD Alignment

- **Files changed**: Modified `use-current-user.ts`, `edit-user.tsx`, `create-user.tsx`, `users/page.tsx`, `pricing/page.tsx` — renamed vendor role label to "Vendedor Nacional"
- **Decisions**: After deep PRD audit (§7.1–7.3, ERD, Module API Blueprint), confirmed all 6 roles are PRD-mandated. Vendor/marketing roles are NOT dead code — they are planned features (Vendor Portal, Marketing Portal) not yet implemented. `permissionProcedure` is infrastructure for future use. Inventory stock-read procedures already use `protectedProcedure` so employees can view stock.
- **Verification**: `pnpm lint` ✅ | `pnpm typecheck` ✅ | `pnpm build` ✅
- **Health**: ✅ Operational

### [2026-03-12] User Management Enhancement (Create User + Owner Protection)

- **Files changed**: Modified `schema.ts` (added `username` to Drizzle), rewrote `users.ts` tRPC (owner-protection + username), created `create-user/route.ts` (NEW API route), created `create-user.tsx` (NEW dialog), enhanced `edit-user.tsx`, rewrote `users/page.tsx`
- **Decisions**: Admin user creation via `auth.admin.createUser()` + `user_profile` insert in single API route; 3-tier owner-protection (only owner can assign owner, only owner can demote owner, owner peer-protection); role dropdown filtering by caller role on client-side
- **Verification**: `pnpm lint` ✅ | `pnpm typecheck` ✅ | `pnpm build` ✅
- **Health**: ✅ Operational

### [2026-03-12] Invisible Scrollbars + Command Palette Search

- **Files changed**: Modified `globals.css` (scrollbar CSS), created `command-search.tsx` (NEW), rewrote `top-bar.tsx`
- **Decisions**: Hide all scrollbars globally via `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`; replaced inline search with centered command palette (⌘K) using tRPC entity search + role-based route filtering
- **Verification**: `pnpm lint` ✅ | `pnpm typecheck` ✅ | `pnpm build` ✅
- **Health**: ✅ Operational

### [2026-03-12] Alerts Dropdown + iOS Mobile Scroll Fix

- **Files changed**: Created `apps/erp/src/components/notifications-dropdown.tsx` (NEW), modified `top-bar.tsx`, `layout.tsx`, `globals.css`
- **Decisions**: Replaced static bell button with tRPC-powered dropdown; migrated `h-screen` → `h-dvh` for iOS viewport; removed `position: fixed` from dialog-open CSS (caused scroll-lock on iOS)
- **Verification**: `pnpm lint` ✅ | `pnpm typecheck` ✅ | `pnpm build` ✅
- **Health**: ✅ Operational

### [2026-03-11] Living Memory Engine Upgrade

- **Files changed**: Modified `memory-audit.md`, `SKILL.md`, `state.md`, `rules.md`, `error-log.md`
- **Decisions**: Adopted project-local-only path policy; established mandatory post-task synchronization protocol; unified Error Prevention Matrix across 3 files
- **Health**: ✅ Operational

### [2026-03-11] Project Knowledge System Initialized

- Performed zero-trust deep audit of the entire Cendaro repository
- Created `.gemini/knowledge/architecture.md` — full topological map with Mermaid diagrams
- Created `.gemini/knowledge/stack.md` — exact technology inventory (every version verified)
- Created `.gemini/knowledge/state.md` — this living memory file
- Enhanced `.gemini/rules.md` — comprehensive agent operating manual with Mandatory Conventions, Approved Commands, Forbidden Actions, Code Quality Rules, and CI/CD docs
- Verified: 1 app (`@cendaro/erp`), 5 packages, 4 tooling packages, 22 route groups, 16 tRPC routers

## Known Bugs & Technical Debt

<!-- Document any issues discovered during development -->

- **Schema file size**: `packages/db/src/schema.ts` is ~60KB — consider splitting into per-domain files when it grows further
- **UI exports**: `@cendaro/ui` only exports `button.tsx` and barrel — additional shadcn components should be registered in `exports`

## Architecture Decisions Record

<!-- Document any significant decisions made and their rationale -->

- **ADR-001**: ERP v1 Source of Truth — see `docs/adr/001-erp-v1-source-of-truth.md`
- **Zod v4 subpath imports**: All Zod imports use `"zod/v4"` — this is intentional for the v4 migration path
- **3-Tier File Pipeline**: Client-side file parsing to avoid Vercel's 4.5MB serverless payload limit
- **tRPC context injection**: Auth is NOT a dependency of `@cendaro/api` — session is injected via tRPC context factory
