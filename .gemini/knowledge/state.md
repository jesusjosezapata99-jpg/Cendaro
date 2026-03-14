# Project State — Living Memory

> This file is maintained by AI agents. Each entry must be timestamped.
> Only write observations relevant to THIS project.

---

## Session Registry

- **Total agent sessions**: 19
- **Last Modified By**: Antigravity Agent — 2026-03-14T04:25:00+01:00

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
