---
version: "2.0"
last-audit: "2026-03-10"
entries: 5
shared-by: ["Gemini/Antigravity", "Claude Code"]
---

# Error Log — Living Memory

This file is the **single source of truth** for error history, shared by ALL agents (Gemini and Claude Code). Every entry makes the system stronger.

## Quick Reference — Active Prevention Rules

| #   | Rule                                                    | Context         |
| --- | ------------------------------------------------------- | --------------- |
| 1   | Tools via `pnpm exec` need root devDependency           | Windows PATH    |
| 2   | Root `eslint.config.ts` required for lint-staged        | ESLint v9       |
| 3   | `?.` + `eslint-disable` for third-party type mismatches | TS ↔ ESLint     |
| 4   | Always `pnpm exec` prefix in lint-staged                | Windows bins    |
| 5   | Verify `exports` field matches file extensions          | Shared packages |

## Entry Template

```markdown
### [YYYY-MM-DD] Brief Title

- **Error**: What failed
- **Root Cause**: Why it failed
- **Fix**: What was done
- **Prevention**: Rule to avoid recurrence
- **Workspace**: Which package(s) were affected
```

---

## Entries

### [2026-03-10] ESLint not found in lint-staged pre-commit hook

- **Error**: `pnpm exec eslint` failed with "command not found" during pre-commit
- **Root Cause**: `eslint` was not in root `devDependencies`; only workspace packages had it
- **Fix**: Added `"eslint": "catalog:"` to root `package.json` devDependencies
- **Prevention**: Any tool used via `pnpm exec` from root must be a root devDependency
- **Workspace**: Root monorepo

### [2026-03-10] ESLint "couldn't find config file" when run from root

- **Error**: ESLint v9 requires `eslint.config.*` in the working directory; none existed at root
- **Root Cause**: Each workspace had its own `eslint.config.ts` but root had none
- **Fix**: Created root `eslint.config.ts` with `defineConfig(baseConfig)` from `@cendaro/eslint-config/base`
- **Prevention**: When running ESLint from root, always ensure a root `eslint.config.ts` exists
- **Workspace**: Root monorepo

### [2026-03-10] TypeScript vs ESLint conflict on optional chaining

- **Error**: `reactPlugin.configs.flat?.recommended?.rules` — TS requires `?.`, ESLint forbids it
- **Root Cause**: `eslint-plugin-react` types declare `.flat.recommended` as possibly undefined, but at runtime it always exists
- **Fix**: Used `?.` with inline `/* eslint-disable @typescript-eslint/no-unnecessary-condition */`
- **Prevention**: For third-party type mismatches, use `?.` + targeted eslint-disable
- **Workspace**: `@cendaro/eslint-config` (tooling/eslint)

### [2026-03-10] Bare eslint/prettier commands fail on Windows

- **Error**: `eslint --cache ...` in lint-staged config failed because binary not in PATH
- **Root Cause**: On Windows, `node_modules/.bin` binaries are not globally available
- **Fix**: Prefixed all lint-staged commands with `pnpm exec`
- **Prevention**: Always use `pnpm exec <tool>` in lint-staged config, never bare commands
- **Workspace**: Root monorepo

### [2026-03-10] @cendaro/ui Skeleton import breaks typecheck

- **Error**: Importing `Skeleton` from `@cendaro/ui` caused build failures
- **Root Cause**: Component not exported; `package.json` exports path mismatch (`.ts` vs `.tsx`)
- **Fix**: Kept local definitions; updated `package.json` exports to match actual files
- **Prevention**: Verify `exports` field matches actual file extensions before importing
- **Workspace**: `@cendaro/ui`, `@cendaro/erp`
