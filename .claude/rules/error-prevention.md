# Error Prevention — Global Rule

This rule is always loaded. It contains the living error matrix and evolutionary learning instructions.

## Error Prevention Matrix

Before making changes, scan this matrix. If your current task matches a pattern, follow the prevention rule.

| Error Pattern                            | Root Cause                                | Prevention Rule                                                              |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| ESLint fails in lint-staged from root    | No root `eslint.config.ts`                | Always ensure root `eslint.config.ts` exists with `defineConfig(baseConfig)` |
| `pnpm exec <cmd>` not found on Windows   | Tool missing from root `devDependencies`  | Add the tool to root `package.json` devDependencies                          |
| TypeScript ↔ ESLint conflict on `?.`     | Types pessimistic, ESLint optimistic      | Use `?.` + `eslint-disable @typescript-eslint/no-unnecessary-condition`      |
| Import from `@cendaro/ui` breaks         | `exports` path mismatch (`.ts` vs `.tsx`) | Verify `exports` field matches actual file extensions                        |
| Pre-push fails on typecheck              | Types broken in committed code            | Run `pnpm typecheck` before committing                                       |
| `FUNCTION_PAYLOAD_TOO_LARGE`             | Raw file sent to Vercel serverless        | Use client-side parsing + chunked JSON (3-Tier Pipeline)                     |
| Stale KI references deprecated packages  | Memory not pruned after upgrades          | Run `/memory-audit` after dependency changes                                 |
| Wrong Supabase project                   | Multiple projects in account              | Verify `project_id = ljwoptpaxazqmnhdczsb` always                            |
| Bare `eslint`/`prettier` fail on Windows | Not in PATH; only via pnpm                | Always prefix: `pnpm exec eslint`, `pnpm exec prettier`                      |
| Agent rules invisible to other AI tools  | Only one config file existed              | Maintain both `.claude/CLAUDE.md` and `.gemini/rules.md`                     |

## Evolutionary Learning

Every error you encounter is a learning opportunity. Follow this protocol:

1. **BEFORE coding**: Read the matrix above. Does your task match any pattern?
2. **DURING coding**: If something fails unexpectedly, analyze the root cause
3. **AFTER fixing**: Append the lesson to `.agents/skills/omni-epistemic-memory/error-log.md`
4. **ALWAYS**: The system grows stronger with every documented error

The error-log.md is the shared memory between ALL agents (Claude + Gemini). Your entries will be read by future sessions of yourself and other agents, preventing the same mistakes forever.
