@AGENTS.md

<!-- Maintainers: shared rules live in AGENTS.md (read by Claude through the import above, and by
     Antigravity and Codex directly). Keep this file for Claude Code only and under 60 lines.
     Package-specific rules: .claude/rules/*.md (loaded only for matching paths). Procedures: .claude/skills/.
     Review after major model releases and delete rules the model already follows.
     Do not run `graphify claude install`: it appends a duplicate graphify section here. -->

# Claude Code specifics

## Tools

- **graphify** is the first stop for "where is / how does" questions (see AGENTS.md). Git hooks rebuild the graph on commit, checkout and merge; run `graphify update .` yourself after a multi-file refactor you have not committed.
- **TypeScript LSP**: to find a definition or references, prefer the LSP tool over reading files.
- **RTK** compresses shell output through a hook. `pnpm lint`, `pnpm build`, `pnpm typecheck` and `pnpm test` run as `rtk err …` / `rtk test …` and print only errors or failures with the real exit code. When output ends with `[full output: rtk recall <id>]`, run that command to see everything.
- **claude-mem** holds what happened in recent sessions. Search it with `project: "TEST"` for "what did we do before" questions instead of reading history files.
- Where each kind of knowledge lives: stable rules in AGENTS.md, this file and .claude/rules; the user's preferences and corrections in auto memory; recent work in claude-mem; auditable history in git log and plans/reports.

## Skills and subagents

- Before any Supabase write, load the `supabase-write` skill and follow it.
- For environment problems (agent-browser, Prettier line endings, stale Next.js types, missing binaries), load the `troubleshooting` skill.
- Project subagents in .claude/agents: `code-reviewer`, `debugger`, `researcher`, `test-runner`, `supabase-guard` (read-only SQL), `browser-tester`.

## Shell

PowerShell and Bash (Git Bash) are both available; pnpm commands work in either, and PowerShell is the better choice for Windows system operations. The Bash tool on this machine turns `\\` into `\` before the shell sees the command, so write files that contain backslashes with the Write tool or through PowerShell, never with a Bash heredoc.

## Plans

Save every implementation plan to `~/.claude/plans/PLAN-YYYY-MM-<NAME>.md`. Specify each phase fully (files, changes, acceptance criteria) and end it with a verification gate.

# Compact instructions

When compacting, keep: the files modified in this session, the verification commands run and their results, the active plan path and current phase, and any decision still waiting on the user.
