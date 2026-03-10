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
packages/api/        → tRPC router layer (@cendaro/api)
packages/auth/       → Supabase auth helpers (@cendaro/auth)
packages/db/         → Drizzle ORM schema + queries (@cendaro/db)
packages/ui/         → Shared UI components (@cendaro/ui)
packages/validators/ → Zod schemas (@cendaro/validators)
tooling/eslint/      → Shared ESLint configs (@cendaro/eslint-config)
tooling/prettier/    → Shared Prettier config (@cendaro/prettier-config)
tooling/tailwind/    → Shared Tailwind config (@cendaro/tailwind-config)
tooling/typescript/  → Shared TSConfig (@cendaro/tsconfig)
```

---

### Pre-Flight Protocol (every code change)

1. Read the `omni-epistemic-memory` skill at `.agents/skills/omni-epistemic-memory/SKILL.md`.
2. Read the Error Log at `.agents/skills/omni-epistemic-memory/error-log.md` — check the Quick Reference table for matching patterns.
3. Read the relevant KI from the OmniCore ERP Technical Handbook before touching architecture.
4. Cross-reference your current task against all known error patterns before writing any code.

### Validation Protocol

5. Always verify changes with `pnpm lint`, `pnpm typecheck`, `pnpm build`. Exit Code 0 = Empirical Truth.
6. Never use bare `eslint` or `prettier` — always `pnpm exec` prefix.

### Safety Protocol

7. Supabase project ID = `ljwoptpaxazqmnhdczsb` (Cendaro). Block `xlgyogcaflsmmwpcuiwk` (Svartx production). Follow `/supabase-safety` workflow.

### Change Management

8. Dependency changes → `/dep-audit` → `/memory-audit`.
9. Critical changes (schema, architecture, security, new pages, API) → `/prd-sync`.

### Environment

10. Windows PowerShell only — no bash/Unix syntax. Use `Get-Content` not `cat`, `Remove-Item` not `rm`, `Get-ChildItem` not `ls`.

---

### Evolutionary Learning Protocol

You are part of a living memory system. Every error you encounter makes the project stronger — but ONLY if you document it.

#### After every bug fix:

1. Analyze the root cause — classify as:
   - **Local**: Workspace-specific (e.g., `@cendaro/ui` exports mismatch)
   - **Global**: Monorepo-wide (e.g., missing root devDependency)
   - **Platform**: Windows-specific (e.g., PATH resolution, command syntax)
2. Validate the fix: `pnpm lint && pnpm typecheck && pnpm build` must all pass
3. Append to `.agents/skills/omni-epistemic-memory/error-log.md`:
   ```
   ### [YYYY-MM-DD] Brief Title
   - **Error**: What failed
   - **Root Cause**: Why it failed
   - **Fix**: What was done
   - **Prevention**: Rule to avoid recurrence
   - **Workspace**: Which package(s) were affected
   ```
4. Update the Quick Reference table if the error represents a new pattern
5. If the fix uncovered an architectural insight, update the relevant KI

#### Before every code change:

- Read the error-log.md Quick Reference table
- If your task matches a known pattern, follow the prevention rule FIRST
- If unsure, ask the user rather than guessing
- Every undocumented fix is lost knowledge — never skip Step 3

---

### Error Prevention Matrix

Before making changes, scan this matrix. If your task matches a pattern, follow the prevention rule.

| Error Pattern                            | Root Cause                                       | Prevention Rule                                                                           |
| ---------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| ESLint fails in lint-staged from root    | No root `eslint.config.ts`                       | Root config must exist with `defineConfig(baseConfig)` from `@cendaro/eslint-config/base` |
| `pnpm exec <cmd>` not found on Windows   | Tool missing from root `devDependencies`         | Add tool to root `package.json` devDependencies before using `pnpm exec`                  |
| TypeScript ↔ ESLint `?.` conflict        | Types pessimistic, ESLint optimistic             | Use `?.` + `eslint-disable @typescript-eslint/no-unnecessary-condition`                   |
| Import from `@cendaro/ui` breaks         | `exports` path mismatch (`.ts` vs `.tsx`)        | Verify `exports` field in `package.json` matches actual file extensions                   |
| Pre-push fails on typecheck              | Types broken in committed code                   | Run `pnpm typecheck` before committing type-affecting changes                             |
| `FUNCTION_PAYLOAD_TOO_LARGE`             | Raw file sent to Vercel serverless (4.5MB limit) | Client-side parsing + chunked JSON upload via 3-Tier Pipeline                             |
| Stale KI references deprecated packages  | Memory not pruned after upgrades                 | Run `/memory-audit` after dependency changes                                              |
| Wrong Supabase project targeted          | Multiple projects in account                     | Verify `project_id = ljwoptpaxazqmnhdczsb` before any MCP DB operation                    |
| Bare `eslint`/`prettier` fail on Windows | `node_modules/.bin` not in system PATH           | Always prefix: `pnpm exec eslint`, `pnpm exec prettier`                                   |
| Agent rules invisible to other AI        | Only one config file existed                     | Maintain `.gemini/rules.md` and `.agents/skills/` as shared references                    |

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

- Schema changes go in `packages/db/src/schema/`
- Always export inferred types for tRPC consumption in `@cendaro/api`
- Run `pnpm -F @cendaro/db generate` after schema changes

---

### MCP Servers

| Server       | Purpose         | Safety                                                         |
| ------------ | --------------- | -------------------------------------------------------------- |
| **Supabase** | Database + Auth | Project: `ljwoptpaxazqmnhdczsb`. Block: `xlgyogcaflsmmwpcuiwk` |
| **Stripe**   | Payments        | Use for billing/payment features                               |
| **Stitch**   | UI design       | Use with `stitch-loop` and `design-md` skills                  |

### Git Hooks

- **pre-commit**: `pnpm exec lint-staged` → `pnpm exec eslint` + `pnpm exec prettier`
- **pre-push**: `pnpm typecheck` + `pnpm build`

### Key Files

| File                                                | Purpose                                     |
| --------------------------------------------------- | ------------------------------------------- |
| `.agents/skills/omni-epistemic-memory/SKILL.md`     | Core agent protocol                         |
| `.agents/skills/omni-epistemic-memory/error-log.md` | Living error history (shared by all agents) |
| `.agents/workflows/dep-audit.md`                    | Dependency upgrade protocol                 |
| `.agents/workflows/memory-audit.md`                 | KI pruning protocol                         |
| `.agents/workflows/prd-sync.md`                     | README/PRD sync protocol                    |
| `.agents/workflows/supabase-safety.md`              | DB operation safety                         |
| `PRD.md`                                            | Product Requirements Document               |
| `README.md`                                         | Technical reference                         |
