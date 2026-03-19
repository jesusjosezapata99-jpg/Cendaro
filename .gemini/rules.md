## Cendaro Monorepo — Mandatory Agent Rules

> **Single source of truth for error history**: `.agents/skills/omni-epistemic-memory/error-log.md`

---

### Project Identity

- **Name**: Cendaro ERP — omnichannel wholesale + retail commerce platform
- **Type**: pnpm monorepo + Turborepo
- **OS**: Windows (PowerShell) — never use bash/Unix syntax
- **Node**: >=20.0.0 | pnpm 10.30.3

### Monorepo Structure

```
apps/erp/            → Next.js 16 ERP frontend (@cendaro/erp)
packages/api/        → tRPC v11 router layer (@cendaro/api)
packages/auth/       → Supabase SSR auth helpers (@cendaro/auth)
packages/db/         → Drizzle ORM v0.45 schema + queries (@cendaro/db)
packages/ui/         → shadcn/ui + Radix UI components (@cendaro/ui)
packages/validators/ → Zod v4 schemas (@cendaro/validators)
tooling/eslint/      → Shared ESLint v9 flat configs (@cendaro/eslint-config)
tooling/prettier/    → Shared Prettier config (@cendaro/prettier-config)
tooling/tailwind/    → Shared Tailwind CSS v4 config (@cendaro/tailwind-config)
tooling/typescript/  → Shared TSConfig (@cendaro/tsconfig)
docs/                → Architecture docs, ADRs, data schemas, product docs
```

---

### Mandatory Conventions

#### Package Manager

- **Always use `pnpm`**. Never use `npm`, `yarn`, or `bun`.
- Use `pnpm exec <tool>` for binary execution — never bare `eslint`, `prettier`, `tsc`.

#### Import Style

- In `@cendaro/erp`: use `~/` path alias (maps to `./src/*`)
- Between packages: use workspace references (`@cendaro/api`, `@cendaro/db`, etc.)
- Within packages: use relative imports (`./`, `../`)

#### File Naming

- React components: `PascalCase.tsx` or `kebab-case.tsx`
- Non-component files: `kebab-case.ts`
- Route directories: `kebab-case` (e.g., `accounts-receivable`, `cash-closure`)
- Schema files: `kebab-case.ts` within `packages/db/src/`

#### Component Patterns

- Use Server Components by default in Next.js App Router
- Add `"use client"` directive only when using hooks, event handlers, or browser APIs
- Use `@t3-oss/env-nextjs` with Zod v4 for environment variable validation
- Use tRPC for all data fetching — never raw `fetch` to internal APIs

#### Zod Import

- Import from `"zod/v4"` (not `"zod"`) — Zod v4 uses the `/v4` subpath

#### Type Exports

- Always export inferred types from Drizzle schema for tRPC consumption
- Use `AppRouter` type from `@cendaro/api` for client-side type safety

---

### Approved Commands

| Action          | Command                                                         |
| --------------- | --------------------------------------------------------------- |
| **Dev**         | `pnpm dev` (all) or `pnpm dev:erp` (ERP only)                   |
| **Build**       | `pnpm build`                                                    |
| **Lint**        | `pnpm lint`                                                     |
| **Lint (fix)**  | `pnpm lint:fix`                                                 |
| **Format**      | `pnpm format`                                                   |
| **Typecheck**   | `pnpm typecheck`                                                |
| **Test**        | `pnpm test`                                                     |
| **DB Push**     | `pnpm db:push`                                                  |
| **DB Studio**   | `pnpm db:studio`                                                |
| **DB Generate** | `pnpm db:generate`                                              |
| **UI Add**      | `pnpm ui-add`                                                   |
| **Clean**       | `pnpm clean` (root) or `pnpm clean:workspaces` (all workspaces) |

---

### Forbidden Actions

1. Never install dependencies not already in the stack without explicit user approval
2. Never write project-specific knowledge to the global `~/.gemini/` directory
3. Never assume technologies from other projects exist here
4. Never use bare `eslint`, `prettier`, or `tsc` — always `pnpm exec` prefix
5. Never use bash/Unix syntax on Windows — use PowerShell equivalents
6. Never use `npm`, `yarn`, or `bun` commands
7. Never target Supabase project `xlgyogcaflsmmwpcuiwk` (Svartx) — always verify `ljwoptpaxazqmnhdczsb` (Cendaro)
8. Never run destructive database operations without user confirmation
9. Never use `pnpm exec tsc --noEmit` with workspace globs — it breaks on Windows

---

### Safety Protocol

7. Supabase project ID = `ljwoptpaxazqmnhdczsb` (Cendaro). Block `xlgyogcaflsmmwpcuiwk` (Svartx production). Follow `/supabase-safety` workflow.

### Change Management

8. Dependency changes → `/dep-audit` → `/memory-audit`.
9. Critical changes (schema, architecture, security, new pages, API) → `/prd-sync`.

### Environment

10. Windows PowerShell only — no bash/Unix syntax. Use `Get-Content` not `cat`, `Remove-Item` not `rm`, `Get-ChildItem` not `ls`.

### Validation Standard

11. Always verify changes with `pnpm lint`, `pnpm typecheck`, `pnpm build`. Exit Code 0 = Empirical Truth.

---

### Code Quality Rules

#### TypeScript

- **Strict mode**: `true` (enforced via `tooling/typescript/base.json`)
- `noUncheckedIndexedAccess`: `true` — all indexed access returns `T | undefined`
- `isolatedModules`: `true` — compatible with Turbopack/esbuild
- Target: `ES2024`, Module: `Preserve`, Resolution: `Bundler`
- Incremental builds with `tsBuildInfoFile` in `.cache/`

#### ESLint

- Flat config format (`eslint.config.ts`) using `defineConfig` from `eslint/config`
- Root extends `@cendaro/eslint-config/base`
- ERP app extends: `base` + `react` + `nextjs` + `restrictEnvAccess`
- ESLint plugins: `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `@next/eslint-plugin-next`, `typescript-eslint`

#### Prettier

- Config: `@cendaro/prettier-config`
- Plugins: `@ianvs/prettier-plugin-sort-imports`, `prettier-plugin-tailwindcss`

---

### Error Prevention Matrix

Before making changes, scan this matrix. If your task matches a pattern, follow the prevention rule.

| Error Pattern                             | Root Cause                                       | Prevention Rule                                                                           |
| ----------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| ESLint fails in lint-staged from root     | No root `eslint.config.ts`                       | Root config must exist with `defineConfig(baseConfig)` from `@cendaro/eslint-config/base` |
| `pnpm exec <cmd>` not found on Windows    | Tool missing from root `devDependencies`         | Add tool to root `package.json` devDependencies before using `pnpm exec`                  |
| TypeScript ↔ ESLint `?.` conflict         | Types pessimistic, ESLint optimistic             | Use `?.` + `eslint-disable @typescript-eslint/no-unnecessary-condition`                   |
| Import from `@cendaro/ui` breaks          | `exports` path mismatch (`.ts` vs `.tsx`)        | Verify `exports` field in `package.json` matches actual file extensions                   |
| Pre-push fails on typecheck               | Types broken in committed code                   | Run `pnpm typecheck` before committing type-affecting changes                             |
| `FUNCTION_PAYLOAD_TOO_LARGE`              | Raw file sent to Vercel serverless (4.5MB limit) | Client-side parsing + chunked JSON upload via 3-Tier Pipeline                             |
| Stale KI references deprecated packages   | Memory not pruned after upgrades                 | Run `/memory-audit` after dependency changes                                              |
| Wrong Supabase project targeted           | Multiple projects in account                     | Verify `project_id = ljwoptpaxazqmnhdczsb` before any MCP DB operation                    |
| Bare `eslint`/`prettier` fail on Windows  | `node_modules/.bin` not in system PATH           | Always prefix: `pnpm exec eslint`, `pnpm exec prettier`                                   |
| Agent rules invisible to other AI         | Only one config file existed                     | Maintain `.gemini/rules.md` and `.agents/skills/` as shared references                    |
| `npx skills add` cross-contamination      | CLI not monorepo-aware, creates dual directories | NEVER use `npx skills add` — git clone + manual copy only                                 |
| Uncommitted changes before user handoff   | Working tree dirty when user interacts with git  | Always `git add . && git commit && git push` BEFORE handing off to user                   |
| Turbo remote cache `413 Entity Too Large` | `.next/**` glob includes `.next/dev/` (875 MB)   | Use specific `.next/{build,server,static,types,cache}/**` globs — never `.next/**`        |

---

### Monorepo Safety Rules

#### Windows Binary Resolution

- Never use bare `eslint`, `prettier`, `tsc` commands — always prefix with `pnpm exec`
- On Windows, `node_modules/.bin/` is NOT in the system PATH
- Use `pnpm exec <tool>` or `pnpm run <script>` exclusively

#### ESLint Architecture

- Root `eslint.config.ts` exists and extends `@cendaro/eslint-config/base`
- Each workspace can have its own `eslint.config.ts` with `tsconfigRootDir: import.meta.dirname`
- lint-staged runs `pnpm exec eslint` from root — the root config must always exist
- ESLint is a root `devDependency` so `pnpm exec eslint` resolves the binary

#### TypeScript Conflict Resolution

- When TypeScript says `?.` is needed but ESLint says it's unnecessary: use `?.` + `eslint-disable`
- Pattern: `/* eslint-disable @typescript-eslint/no-unnecessary-condition */`
- This happens with third-party type declarations where types are pessimistic

#### Shared Package Imports

- Before importing from `@cendaro/ui` or any shared package, verify:
  1. The component is exported in the package's `package.json` `exports` field
  2. File extensions match (`.ts` vs `.tsx`)
  3. The component actually exists in the source directory
- If a component doesn't exist in the shared package, create it locally first

#### Turbo Pipeline

- `pnpm build` → `turbo run build` → resolves workspace dependency graph
- `pnpm typecheck` → `turbo run typecheck` → per-workspace `tsconfig.json`
- `pnpm lint` → `turbo run lint` → per-workspace `eslint.config.ts`
- Never use `pnpm exec tsc --noEmit` with workspace globs — it breaks on Windows

---

### Supabase Operations Safety

#### Project Identification

| Project              | ID                     | Status            |
| -------------------- | ---------------------- | ----------------- |
| **Cendaro** (target) | `ljwoptpaxazqmnhdczsb` | ✅ Safe to modify |
| **Svartx** (blocked) | `xlgyogcaflsmmwpcuiwk` | 🚫 NEVER touch    |

#### Before Any DB Operation

1. Confirm you are targeting project `ljwoptpaxazqmnhdczsb`
2. If using MCP Supabase tools, pass `project_id: "ljwoptpaxazqmnhdczsb"` explicitly
3. Never run destructive operations without user confirmation

#### Migration Rules

- Name migrations in `snake_case` with descriptive names
- Always include `IF NOT EXISTS` for table creation
- Always include `IF EXISTS` for table drops
- Never drop columns in production without a migration plan

#### RLS (Row Level Security)

- Every new table MUST have RLS enabled
- Every table MUST have at least one RLS policy
- Run security advisors after DDL changes: use MCP `get_advisors` with type "security"

#### Drizzle ORM

- Schema changes go in `packages/db/src/schema.ts` (single 60KB file)
- Always export inferred types for tRPC consumption in `@cendaro/api`
- Run `pnpm db:generate` after schema changes, then `pnpm db:push`
- Database driver: `postgres` (pg.js) — NOT `pg` or `@neondatabase/serverless`

---

### MCP Servers

| Server       | Purpose         | Safety                                                         |
| ------------ | --------------- | -------------------------------------------------------------- |
| **Supabase** | Database + Auth | Project: `ljwoptpaxazqmnhdczsb`. Block: `xlgyogcaflsmmwpcuiwk` |
| **Stripe**   | Payments        | Use for billing/payment features                               |
| **Stitch**   | UI design       | Use with `stitch-loop` and `design-md` skills                  |

### Git Hooks (Husky)

- **pre-commit**: `pnpm exec lint-staged` → runs ESLint + Prettier on staged files
- **pre-push**: `pnpm typecheck` + `pnpm build`

### CI/CD Pipeline

- **GitHub Actions** on push to `main` + all PRs
- Steps: `install` → `typecheck` → `lint` → `build` → `test` (test is non-blocking)
- Runner: `ubuntu-latest`, Node 20, pnpm 10.30.3
- Remote caching: Turbo Token + Team via GitHub secrets

### Key Files

| File                                                | Purpose                                     |
| --------------------------------------------------- | ------------------------------------------- |
| `.agents/skills/omni-epistemic-memory/SKILL.md`     | Core agent protocol                         |
| `.agents/skills/omni-epistemic-memory/error-log.md` | Living error history (shared by all agents) |
| `.agents/workflows/dep-audit.md`                    | Dependency upgrade protocol                 |
| `.agents/workflows/memory-audit.md`                 | KI pruning protocol                         |
| `.agents/workflows/prd-sync.md`                     | README/PRD sync protocol                    |
| `.agents/workflows/supabase-safety.md`              | DB operation safety                         |
| `.gemini/knowledge/architecture.md`                 | System topological map                      |
| `.gemini/knowledge/stack.md`                        | Technology inventory (exact versions)       |
| `.gemini/knowledge/state.md`                        | Living memory — rolling agent log           |
| `PRD.md`                                            | Product Requirements Document               |
| `README.md`                                         | Technical reference                         |
| `docs/`                                             | Architecture docs, ADRs, data schemas       |
