---
version: "3.2"
last-audit: "2026-05-21"
entries: 12
shared-by: ["Gemini/Antigravity"]
---

# Error Log — Living Memory

This file is the **single source of truth** for error history. Every entry makes the system stronger.  
**Maintained by**: Claude Opus 4.6 Adaptive Thinking (Antigravity)  
**Project**: Cendaro ERP — `ljwoptpaxazqmnhdczsb`

## Quick Reference — Active Prevention Rules

| #   | Rule                                                                                                                                                                     | Context                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 1   | Tools via `pnpm exec` need root devDependency                                                                                                                            | Windows PATH           |
| 2   | Root `eslint.config.ts` required for lint-staged                                                                                                                         | ESLint v9              |
| 3   | `?.` + `eslint-disable` for third-party type mismatches                                                                                                                  | TS ↔ ESLint            |
| 4   | Always `pnpm exec` prefix in lint-staged                                                                                                                                 | Windows bins           |
| 5   | Verify `exports` field matches file extensions                                                                                                                           | Shared packages        |
| 6   | NEVER use `npx skills add` — git clone + manual copy                                                                                                                     | Skills install         |
| 7   | Always commit + push BEFORE handing off to user                                                                                                                          | Git discipline         |
| 8   | Run `pnpm typecheck` before committing type changes                                                                                                                      | Pre-push guard         |
| 9   | Client-side parsing + chunked JSON for file uploads                                                                                                                      | Vercel 4.5MB           |
| 10  | Verify `project_id = ljwoptpaxazqmnhdczsb` before DB ops                                                                                                                 | Supabase safety        |
| 11  | Run `/memory-audit` after dependency changes                                                                                                                             | KI freshness           |
| 12  | Maintain `.gemini/rules.md` + `.agents/skills/` as refs                                                                                                                  | Multi-agent            |
| 13  | Use specific `.next/{build,server,static,types,cache}/**` globs                                                                                                          | Turbo remote cache     |
| 14  | NEVER set `PATH` in `~/.claude/settings.json` env section                                                                                                                | Claude Code env        |
| 15  | After claude-mem MCP fix, verify `bash` in Windows system PATH                                                                                                           | Plugin hooks           |
| 16  | NEVER use PowerShell `-Encoding UTF8` for Bun config files — use `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))` to avoid BOM | claude-mem settings    |
| 17  | Both `cache/` and `marketplaces/` dirs are needed for claude-mem — patch BOTH `.mcp.json` files when fixing Windows compat                                               | claude-mem dual-source |
| 18  | NEVER use dynamic segment configurations (e.g. `export const dynamic = "force-dynamic"`) when `cacheComponents` is enabled globally                                      | Next.js 16 routes      |
| 19  | NEVER use dynamic runtime constructors (e.g. `new Date()`) inside static Server Components to avoid prerendering failure                                                 | Next.js 16 rendering   |

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

### [2026-05-08] Claude Code `settings.json` PATH Override Destroys All MCP Servers

- **Error**: After adding `"PATH": "C:\\Program Files\\Git\\bin;%PATH%"` to `~/.claude/settings.json` `env` section, all MCP servers (sequential-thinking, stripe, supabase, claude-mem) failed with `X Failed`. Only `context7` (HTTP transport) survived.
- **Root Cause**: Claude Code's `env` section in `settings.json` **replaces** environment variables — it does NOT expand shell variable syntax like `%PATH%`. Setting `PATH` to a string containing `%PATH%` literally destroys the entire system PATH, removing access to `node`, `npx`, `pnpm`, and all binaries that MCP servers depend on.
- **Fix**: (1) Removed `PATH` from `settings.json` env. (2) Added `C:\Program Files\Git\bin` to Windows User PATH via `[System.Environment]::SetEnvironmentVariable("Path", ..., "User")` instead. (3) Killed 16+ zombie node processes from failed MCP startups.
- **Prevention**: **NEVER add `PATH` to `~/.claude/settings.json` `env` section.** To make binaries available to Claude Code, modify the Windows User PATH via registry (`[System.Environment]::SetEnvironmentVariable`). The `env` section only supports setting NEW variables, not extending existing ones.
- **Workspace**: Claude Code infrastructure (`~/.claude/settings.json`)
- **Severity**: Critical
- **Recurrence**: 1st

### [2026-05-08] Claude-mem Plugin Hooks Hang on Windows (bash not in PATH)

- **Error**: Claude Code crashes with `Subprocess initialization did not complete within 60000ms` after fixing the claude-mem MCP server in Session 79.
- **Root Cause**: Plugin `claude-mem` v12.7.5 registers 7 hooks with `"shell": "bash"`. On Windows, `bash.exe` exists at `C:\Program Files\Git\bin\bash.exe` but only `C:\Program Files\Git\cmd` is in PATH (exposes `git.exe` only, NOT `bash.exe`). Before Session 79, the MCP server was broken so hooks were dormant. After the fix, hooks started executing → bash not found → `SessionStart` hook hangs for 60 seconds → timeout kills Claude Code.
- **Fix**: Added `C:\Program Files\Git\bin` to Windows User PATH permanently via `[System.Environment]::SetEnvironmentVariable("Path", "$currentPath;C:\Program Files\Git\bin", "User")`.
- **Prevention**: **After ANY claude-mem MCP server fix on Windows, ALWAYS verify that `bash` is accessible in the system PATH** (`Get-Command bash`). If not, add `C:\Program Files\Git\bin` to the User PATH. The plugin hooks hardcode `"shell": "bash"` and this cannot be changed without modifying plugin files (which auto-update).
- **Workspace**: Claude Code infrastructure (`~/.claude/plugins/cache/thedotmack/claude-mem/`)
- **Severity**: Critical
- **Recurrence**: 1st

### [2026-03-14] Turborepo Remote Cache 413 Entity Too Large

- **Error**: `turbo run build` emitted `413 Request Entity Too Large` when uploading remote cache artifact to Vercel. Build succeeded locally but remote cache upload failed on every run.
- **Root Cause**: `turbo.json` used `.next/**` as a build output glob, which captured `.next/dev/` — Turbopack's dev cache directory at 875 MB. This caused the remote cache artifact to exceed Vercel's 500 MB upload limit.
- **Fix**: Replaced `.next/**` with specific subdirectory globs in `turbo.json`: `.next/build/**`, `.next/server/**`, `.next/static/**`, `.next/types/**`, `.next/cache/**`, `.next/*.json`, `.next/*.js`, `.next/BUILD_ID`, `.next/package.json`. Cleaned stale `.next/dev` (875 MB) and `.next/diagnostics` directories. Post-cleanup remote cache payload: ~35 MB.
- **Prevention**: Never use `.next/**` in `turbo.json` outputs — always enumerate specific subdirectory globs that exclude `.next/dev/` and `.next/diagnostics/`.
- **Workspace**: Root monorepo (`turbo.json`)
- **Severity**: Major
- **Recurrence**: 1st

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

### [2026-05-21] Next.js 16 dynamic route segment override conflict with `cacheComponents`

- **Error**: `pnpm build` failed to compile dynamic routes because of segment overrides.
- **Root Cause**: Custom route configs such as `export const dynamic = "force-dynamic"` are fully rejected by Turbopack if `cacheComponents: true` is enabled globally.
- **Fix**: Removed the conflicting segment override.
- **Prevention**: Do not use `export const dynamic = "force-dynamic"` or similar segment overrides in App Router routes when `cacheComponents` is active. Rely on the framework's native dynamic resolution instead.
- **Workspace**: `@cendaro/erp` (`apps/erp/src/app/api/ai/parse-packing-list/route.ts`)
- **Severity**: Major
- **Recurrence**: 1st

### [2026-05-21] Next.js 16 dynamic runtime date constructor static generation prerender failure

- **Error**: `pnpm build` failed during static page generation / prerendering due to dynamic code execution in `footer.tsx`.
- **Root Cause**: In Next.js 16, utilizing dynamic date constructors (`new Date()`) inside static Server Components without matching headers or dynamic requests fails the compiler's prerender checks.
- **Fix**: Replaced dynamic year calculation with compile-time optimized static constant `2026`.
- **Prevention**: Never use dynamic, non-deterministic constructors inside static Server Components. Move them to Client Component scopes or use static compile-time constants.
- **Workspace**: `@cendaro/erp` (`apps/erp/src/app/_components/landing/footer.tsx`)
- **Severity**: Major
- **Recurrence**: 1st

---

## Statistics

| Metric                    | Value                        |
| ------------------------- | ---------------------------- |
| **Total entries**         | 12                           |
| **Critical**              | 5                            |
| **Major**                 | 6                            |
| **Minor**                 | 1                            |
| **Most common workspace** | Root monorepo (6/12 entries) |
| **Date of last entry**    | 2026-05-21                   |
| **Quick Reference rules** | 19                           |
