# Cendaro ERP — Project Memory

> **SYNC**: Gemini/Antigravity reads `.gemini/rules.md`. Both rule sets share `.agents/skills/omni-epistemic-memory/error-log.md` as the single source of truth for error history.

## Project Identity

- **Name**: Cendaro ERP — omnichannel wholesale + retail commerce platform
- **Type**: pnpm monorepo + Turborepo
- **OS**: Windows (PowerShell) — never use bash/Unix syntax
- **Node**: >=20.0.0 | pnpm 10.30.3

## Context Imports

@README.md
@pnpm-workspace.yaml
@.agents/skills/omni-epistemic-memory/error-log.md

## Monorepo Structure

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

## Mandatory Rules

1. **Pre-flight read**: Before ANY code change, read `.agents/skills/omni-epistemic-memory/SKILL.md` and the Error Log at `.agents/skills/omni-epistemic-memory/error-log.md`. Check the Error Prevention Matrix for patterns that match your current task.
2. **Validation gate**: Always run `pnpm lint`, `pnpm typecheck`, `pnpm build` before considering work complete. Exit Code 0 = truth.
3. **Post-fix logging**: After fixing ANY bug, append the lesson to `error-log.md` following the template in the skill (Step D). This is non-negotiable.
4. **Windows commands**: Never use bare `eslint`/`prettier` — always use `pnpm exec` prefix. Never use `cat`, `ls`, `rm` — use PowerShell equivalents.
5. **Supabase safety**: Project ID = `ljwoptpaxazqmnhdczsb` (Cendaro). NEVER touch `xlgyogcaflsmmwpcuiwk` (Svartx production).
6. **Dependency changes**: Follow the workflow in `.agents/workflows/dep-audit.md`, then prune stale KIs with `.agents/workflows/memory-audit.md`.
7. **Critical changes**: For schema, architecture, security, new pages, or API changes — follow `.agents/workflows/prd-sync.md`.

## Evolutionary Learning Protocol

You are part of a living memory system. Every error you encounter makes the project stronger — but ONLY if you document it.

### After every bug fix:

1. Analyze the root cause (local workspace vs global monorepo vs Windows-specific)
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

### Before every code change:

- Read the error-log.md Quick Reference table
- If your task matches a known pattern, follow the prevention rule FIRST
- If unsure, ask the user rather than guessing

## MCP Servers

| Server       | Purpose         | Safety                                                         |
| ------------ | --------------- | -------------------------------------------------------------- |
| **Supabase** | Database + Auth | Project: `ljwoptpaxazqmnhdczsb`. Block: `xlgyogcaflsmmwpcuiwk` |
| **Stripe**   | Payments        | Use for billing/payment features                               |
| **Stitch**   | UI design       | Use with `stitch-loop` and `design-md` skills                  |

## Git Hooks

- **pre-commit**: `pnpm exec lint-staged` → `pnpm exec eslint` + `pnpm exec prettier`
- **pre-push**: `pnpm typecheck` + `pnpm build`
