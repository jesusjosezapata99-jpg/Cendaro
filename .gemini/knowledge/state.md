# Project State — Living Memory

> This file is maintained by AI agents. Each entry must be timestamped.
> Only write observations relevant to THIS project.

---

## Session Registry

- **Total agent sessions**: 4
- **Last Modified By**: Antigravity Agent — 2026-03-12T03:45:00+01:00

---

## Current Status

- **Project health**: ✅ Operational — monorepo builds, lints, and typechecks cleanly
- **Last agent interaction**: 2026-03-12T03:45:00+01:00
- **Known issues**: None critical

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

### [2026-03-12] Product Reference System + Order Typeahead

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
