---
version: "3.0"
last-audit: "2026-03-11"
entries: 7
shared-by: ["Gemini/Antigravity", "Claude Code"]
---

# Error Log — Living Memory

This file is the **single source of truth** for error history, shared by ALL agents (Gemini and Claude Code). Every entry makes the system stronger.

## Quick Reference — Active Prevention Rules

| #   | Rule                                                     | Context         |
| --- | -------------------------------------------------------- | --------------- |
| 1   | Tools via `pnpm exec` need root devDependency            | Windows PATH    |
| 2   | Root `eslint.config.ts` required for lint-staged         | ESLint v9       |
| 3   | `?.` + `eslint-disable` for third-party type mismatches  | TS ↔ ESLint     |
| 4   | Always `pnpm exec` prefix in lint-staged                 | Windows bins    |
| 5   | Verify `exports` field matches file extensions           | Shared packages |
| 6   | NEVER use `npx skills add` — git clone + manual copy     | Skills install  |
| 7   | Always commit + push BEFORE handing off to user          | Git discipline  |
| 8   | Run `pnpm typecheck` before committing type changes      | Pre-push guard  |
| 9   | Client-side parsing + chunked JSON for file uploads      | Vercel 4.5MB    |
| 10  | Verify `project_id = ljwoptpaxazqmnhdczsb` before DB ops | Supabase safety |
| 11  | Run `/memory-audit` after dependency changes             | KI freshness    |
| 12  | Maintain `.gemini/rules.md` + `.agents/skills/` as refs  | Multi-agent     |

## Entry Template

```markdown
### [YYYY-MM-DD] Brief Title

- **Error**: What failed
- **Root Cause**: Why it failed
- **Fix**: What was done
- **Prevention**: Rule to avoid recurrence
- **Workspace**: Which package(s) were affected
- **Severity**: Critical / Major / Minor
- **Recurrence**: 1st (or Nth — cite Quick Reference rule #)
```

---

## Entries

### [2026-03-11] `npx skills add` creates cross-directory contamination

- **Error**: `npx skills add` created files in BOTH `.agents/skills/` AND `.agent/skills/`, duplicating content across 2 parallel directory trees, generating ~100 unnecessary files (READMEs, configs, lock files, test scaffolds) with 25,320 lines of insertions — structural chaos
- **Root Cause**: The `npx skills add` CLI is not monorepo-aware. It auto-detects (or creates) `.agent/skills/` as a secondary target in addition to `.agents/skills/`, dumping redundant scaffolding files (`.gitignore`, `package.json`, `pnpm-lock.yaml`, `TESTS.md`, etc.) that don't belong in a curated skill directory
- **Fix**: `git reset --hard afe09bd` to revert entirely, then manually re-created the 3 skills using `git clone --depth 1` from GitHub + surgical `Copy-Item` of ONLY `SKILL.md` files and `resources/`/`references/` directories — zero scaffolding
- **Prevention**: **NEVER use `npx skills add` or any automated skill installer.** Always use `git clone --depth 1` to a temp directory, copy only the needed files (`SKILL.md` + resource dirs), then delete the temp repo. Verify: (a) no `.agent/` directory created, (b) no `.git/`, `package.json`, lock files, or test scaffolds copied, (c) skill count matches expected total
- **Workspace**: `.agents/skills/` (root monorepo)
- **Severity**: Critical
- **Recurrence**: 1st

### [2026-03-11] Local changes not committed before user pull attempt

- **Error**: User ran `git pull` and got merge conflicts because local changes (shadcn/ui improvements + new Resend skill files) were uncommitted while remote still had the old broken commit
- **Root Cause**: After `git reset --hard` and re-applying changes, the agent handed off to the user without first committing the new changes and syncing with remote. This left modified files (shadcn-ui) and untracked files (resend skills) in a limbo state that conflicts with `git pull`
- **Fix**: Commit all local changes, then force push to overwrite the broken remote state
- **Prevention**: **After ANY git reset or file modifications, ALWAYS: (1) `git add .`, (2) `git commit -m "..."`, (3) `git push` (or `git push --force-with-lease` if history was rewritten via reset) BEFORE handing off to the user.** Never leave the working tree dirty when the user is expected to interact with git
- **Workspace**: Root monorepo
- **Severity**: Major
- **Recurrence**: 1st

### [2026-03-10] ESLint not found in lint-staged pre-commit hook

- **Error**: `pnpm exec eslint` failed with "command not found" during pre-commit
- **Root Cause**: `eslint` was not in root `devDependencies`; only workspace packages had it
- **Fix**: Added `"eslint": "catalog:"` to root `package.json` devDependencies
- **Prevention**: Any tool used via `pnpm exec` from root must be a root devDependency
- **Workspace**: Root monorepo
- **Severity**: Critical
- **Recurrence**: 1st

### [2026-03-10] ESLint "couldn't find config file" when run from root

- **Error**: ESLint v9 requires `eslint.config.*` in the working directory; none existed at root
- **Root Cause**: Each workspace had its own `eslint.config.ts` but root had none
- **Fix**: Created root `eslint.config.ts` with `defineConfig(baseConfig)` from `@cendaro/eslint-config/base`
- **Prevention**: When running ESLint from root, always ensure a root `eslint.config.ts` exists
- **Workspace**: Root monorepo
- **Severity**: Critical
- **Recurrence**: 1st

### [2026-03-10] TypeScript vs ESLint conflict on optional chaining

- **Error**: `reactPlugin.configs.flat?.recommended?.rules` — TS requires `?.`, ESLint forbids it
- **Root Cause**: `eslint-plugin-react` types declare `.flat.recommended` as possibly undefined, but at runtime it always exists
- **Fix**: Used `?.` with inline `/* eslint-disable @typescript-eslint/no-unnecessary-condition */`
- **Prevention**: For third-party type mismatches, use `?.` + targeted eslint-disable
- **Workspace**: `@cendaro/eslint-config` (tooling/eslint)
- **Severity**: Minor
- **Recurrence**: 1st

### [2026-03-10] Bare eslint/prettier commands fail on Windows

- **Error**: `eslint --cache ...` in lint-staged config failed because binary not in PATH
- **Root Cause**: On Windows, `node_modules/.bin` binaries are not globally available
- **Fix**: Prefixed all lint-staged commands with `pnpm exec`
- **Prevention**: Always use `pnpm exec <tool>` in lint-staged config, never bare commands
- **Workspace**: Root monorepo
- **Severity**: Major
- **Recurrence**: 1st

### [2026-03-10] @cendaro/ui Skeleton import breaks typecheck

- **Error**: Importing `Skeleton` from `@cendaro/ui` caused build failures
- **Root Cause**: Component not exported; `package.json` exports path mismatch (`.ts` vs `.tsx`)
- **Fix**: Kept local definitions; updated `package.json` exports to match actual files
- **Prevention**: Verify `exports` field matches actual file extensions before importing
- **Workspace**: `@cendaro/ui`, `@cendaro/erp`
- **Severity**: Major
- **Recurrence**: 1st

---

## Statistics

| Metric                    | Value                       |
| ------------------------- | --------------------------- |
| **Total entries**         | 7                           |
| **Critical**              | 3                           |
| **Major**                 | 3                           |
| **Minor**                 | 1                           |
| **Most common workspace** | Root monorepo (5/7 entries) |
| **Date of last entry**    | 2026-03-11                  |
| **Quick Reference rules** | 12                          |
