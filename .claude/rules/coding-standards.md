# Cendaro ERP — Coding Standards & Best Practices

> Authoritative source for all code quality decisions.
> Loaded as a modular rule by Claude Code from `.claude/rules/`.

---

## TypeScript

- **Strict mode** enabled — zero `any` types, zero `@ts-ignore`
- Use `interface` for object shapes; `type` for unions, intersections, and mapped types
- Prefer `const` assertions (`as const`) and the `satisfies` operator
- Explicit return types required in `packages/api/`, `apps/erp/src/app/api/`, and server actions
- No implicit `undefined` returns — all code paths must return explicitly
- Use discriminated unions for state machines and API response types
- `noUncheckedIndexedAccess: true` — all indexed access returns `T | undefined`
- `isolatedModules: true` — compatible with Turbopack/esbuild

```ts
// ✅ Good
interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

// ❌ Bad
const getOrder = async (id: any) => { ... }
```

---

## Zod v4

- **Always** import from `'zod/v4'` — never from `'zod'`
- Use `drizzle-zod` for Drizzle ↔ Zod schema bridges
- Place shared schemas in `packages/validators/`

```ts
// ✅ Good

// ❌ Bad
import { z } from "zod";
import { z } from "zod/v4";
```

---

## Imports & Module Resolution

### In `@cendaro/erp` (apps/erp/)

- **Always** use `~/` alias — never relative paths climbing more than one level (`../../`)
- `~/` maps to `./src/*`

### Between packages

- Use workspace references: `@cendaro/api`, `@cendaro/db`, `@cendaro/auth`, `@cendaro/ui`, `@cendaro/validators`

### Within packages

- Use relative imports (`./`, `../`)

### Sort order (enforced by ESLint + Prettier)

1. React / Next.js internals
2. Third-party packages
3. Workspace packages (`@cendaro/*`)
4. `~/` alias imports
5. Relative imports
6. Type-only imports (`import type`) at the end

```ts
// ✅ Good
import { NextRequest } from "next/server";
import { z } from "zod/v4";

import type { RouterOutput } from "@cendaro/api";
import { db } from "@cendaro/db/client";

import { AppSidebar } from "~/components/app-sidebar";
// ❌ Bad
import { something } from "../../../lib/something";
```

---

## tRPC Patterns

### Router procedures

- All business logic lives in `packages/api/src/modules/`
- Use `protectedProcedure` for authenticated routes, `publicProcedure` only for health checks
- Input validation via Zod v4 schemas from `@cendaro/validators`
- Return typed objects — never raw Drizzle rows without mapping

### Context creation

- tRPC context provides: `db` (Drizzle client), `session` (Supabase auth), `user` (decoded JWT)
- Auth is injected via context — never check auth inside individual procedures

```ts
// ✅ Good
export const catalogRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(products).where(...)
    }),
})

// ❌ Bad — checking auth inside procedure
export const catalogRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) throw new Error('Unauthorized') // Wrong!
  }),
})
```

---

## Drizzle ORM

- Schema definitions in `packages/db/src/schema.ts`
- Use `createInsertSchema()` and `createSelectSchema()` from `drizzle-zod` for type bridges
- Export inferred types (`$inferSelect`, `$inferInsert`) for tRPC consumption
- Prefer `db.select().from(table).where(...)` over raw SQL
- Use `db.transaction()` for multi-table writes
- Never use `sql.raw()` without parameterized inputs — SQL injection risk

```ts
// ✅ Good
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// ✅ Good — parameterized
const results = await db.select().from(products).where(eq(products.id, id));

// ❌ Bad — raw SQL injection risk
const results = await db.execute(
  sql.raw(`SELECT * FROM products WHERE id = '${id}'`),
);
```

---

## React & Next.js

- **Server Components by default** — `"use client"` only when using hooks, event handlers, or browser APIs
- Icons **only** from `Icons` / `Icon` in `@cendaro/ui/icons` — no `lucide-react`, no Heroicons, no FontAwesome, no raw `material-symbols-outlined` spans, no emojis in UI. Static name → `<Icons.Pascal />`; dynamic name → `<Icon name={value as IconName} />`
- Error boundaries use `error.tsx` convention
- No `console.log` in production code — use the project `logger` utility
- Use `@t3-oss/env-nextjs` with Zod v4 for environment variable validation
- Use `next-themes` for dark/light mode — never custom theme logic
- Animations via `framer-motion` — not CSS transitions for complex motion

## Design System (Midday-derived, PLAN-2026-09-MIDDAY-REDESIGN)

- **Radius is 0 everywhere** (`--radius: 0rem`) — never add `rounded-sm/md/lg/xl/2xl/3xl` to new code. `rounded-full` is allowed **only** on pills (`StatusPill`, `Badge` tag-rounded) and avatars (`Avatar variant="user"`)
- **No `font-semibold`/`font-bold`/`font-extrabold`** anywhere — Hedvig Letters Sans/Serif ship weight 400 only; a heavier class forces a synthesized fake bold in Chrome. Use `font-medium` (the heaviest real cut) plus size/color for hierarchy (e.g. monetary totals)
- **Status chips go through `~/lib/status.ts`** (`getStatus(domain, value) → {label, tone}`) + `StatusPill` from `@cendaro/ui/status-pill` — never a new inline `STATUS_CONFIG` map. `StatusBadge` is a deprecated compatibility wrapper only
- **Colors only via design tokens** (`bg-background`, `text-muted-foreground`, `bg-status-success-bg`, etc.) — never a raw hex/rgb literal in `apps/erp/src`. Add a token to `tooling/tailwind/theme.css` first if one is missing
- Shadows only where `packages/ui/src` primitives already use them (dialog/sheet/dropdown/popover: `shadow-md`) — no stray `shadow-*` in page code
- Run `node scripts/checks/design-guard.mjs --phase <current>` before considering UI work in a phase done — it fails the build if a forbidden pattern regresses

---

## File & Folder Organization

```
apps/erp/
  src/
    app/
      (app)/              → Authenticated ERP pages (route group)
        dashboard/
        catalog/
        inventory/
        ...
      api/                → Route handlers (tRPC, auth, AI)
      login/              → Public login page
    components/           → Shared layout components
    hooks/                → Custom React hooks
    lib/                  → Utilities
    modules/              → Domain-specific UI modules
    trpc/                 → tRPC client setup
    env.ts                → Environment validation
```

---

## Component Patterns

- Use shadcn/ui components from `@cendaro/ui` — install via `pnpm ui-add`
- Compose with `cn()` utility (clsx + tailwind-merge)
- Use `class-variance-authority (CVA)` for component variants
- Data tables use `@tanstack/react-virtual` for virtualization

---

## Security

- Env validation via `@t3-oss/env-nextjs` — crash on missing vars
- Auth middleware in `packages/auth/middleware` — validates Supabase session on every request
- tRPC context injects auth — procedures use `protectedProcedure` for RBAC
- File uploads: client-side parsing + chunked JSON (avoid Vercel's 4.5MB serverless limit)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client — server-only

---

## Performance

- No N+1 queries — use Drizzle joins or batch selects
- Virtual scrolling for large tables (`@tanstack/react-virtual`)
- Dynamic imports for heavy components (xlsx, pdf-parse, jszip)
- Images use Next.js `<Image>` with `sharp` optimization
- Turbopack for dev server — Webpack for production builds

---

## Package Manager

- **Always `pnpm`** — never `npm`, `yarn`, or `bun`
- **Always `pnpm exec <tool>`** for binary execution — never bare `eslint`, `prettier`, `tsc`
- Add new dependencies to the correct workspace: `pnpm -F @cendaro/erp add <pkg>`

---

## Windows Environment

- PowerShell syntax only — never bash/Unix
- `Get-Content` not `cat`, `Remove-Item` not `rm`, `Get-ChildItem` not `ls`
- `pnpm exec tsc` not bare `tsc`

---

## Error Prevention Matrix

| Error Pattern                                                | Root Cause                                                                   | Prevention Rule                                                                                                           |
| :----------------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| ESLint fails in lint-staged                                  | No root `eslint.config.ts`                                                   | Root config must exist with `defineConfig(baseConfig)`                                                                    |
| `pnpm exec <cmd>` not found                                  | Tool missing from root devDependencies                                       | Add to root `package.json`                                                                                                |
| TypeScript ↔ ESLint `?.` conflict                            | Types pessimistic, ESLint optimistic                                         | Use `?.` + eslint-disable                                                                                                 |
| `FUNCTION_PAYLOAD_TOO_LARGE`                                 | Raw file sent to Vercel serverless                                           | Client-side parsing + chunked JSON                                                                                        |
| Wrong Supabase project targeted                              | Multiple projects in account                                                 | Verify `ljwoptpaxazqmnhdczsb` before any MCP DB op                                                                        |
| Bare `eslint`/`prettier` fail                                | `node_modules/.bin` not in PATH                                              | Always `pnpm exec` prefix                                                                                                 |
| Zod import wrong                                             | `from 'zod'` instead of `from 'zod/v4'`                                      | Always `import { z } from 'zod/v4'`                                                                                       |
| Turbo cache too large                                        | `.next/**` glob includes dev cache                                           | Use specific `.next/{build,server,static,types,cache}/**`                                                                 |
| Raw `<span className="material-symbols-outlined">` reappears | Copy-pasted from an old file / AI training data                              | Icons only via `Icons.Pascal` or `Icon name={x as IconName}` from `@cendaro/ui/icons`                                     |
| New component has rounded corners                            | `rounded-*` copied from a pre-Midday snippet                                 | Radius is 0 by design; `rounded-full` only on pills/avatars                                                               |
| Dashboard/table text looks too light                         | Reflex to reach for `font-bold`/`font-semibold`                              | Use `font-medium` + size/color, never a heavier weight (Hedvig has no bold cut)                                           |
| Duplicate `STATUS_CONFIG` map added in a new page            | Not knowing `~/lib/status.ts` exists                                         | Add the domain/value pair to `getStatus()` in `lib/status.ts` instead                                                     |
| `apps/erp/.next/dev/types/*` breaks `tsc --noEmit`           | Generated Next.js dev-route types corrupted by a concurrent dev-server write | Safe to delete (gitignored, regenerates); if it recurs, re-run `pnpm build` instead of raw `tsc` as the verification gate |
