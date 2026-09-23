# AgentShield — agent configuration audit

Security audit of the AI agent surface of this repository: `.claude/`,
`.codex/`, `.gemini/`, `AGENTS.md`, `CLAUDE.md`, agent definitions, hooks, MCP
servers and permission rules. Part of PLAN-2026-09-SECURITY-REMEDIATION F10.3.

## How it runs

The scanner is an **exact devDependency** (`ecc-agentshield`, pinned in
`pnpm-lock.yaml` with its integrity hash), not an action that downloads code at
run time. CI runs the same binary as a developer does.

| Command                         | What it does                                                   |
| :------------------------------ | :------------------------------------------------------------- |
| `pnpm security:agents`          | Full report at medium+, mapped to SOC 2 and ISO 27001 controls |
| `pnpm security:agents:gate`     | What CI enforces: fails on any regression against the baseline |
| `pnpm security:agents:baseline` | Re-records `baseline.json` — only after reviewing the diff     |
| `pnpm security:agents:evidence` | Writes a redacted evidence bundle for an audit                 |

CI (`.github/workflows/ci.yml`, job `agentshield`) enforces two gates and
uploads SARIF to the repository Security tab:

1. **Floor** — any high or critical finding fails, with no baseline to hide
   behind.
2. **Drift** — compared against `baseline.json` at the severity it was recorded
   at (medium), so any _new_ finding or a lower score fails.

## Current posture (2026-09-20)

**95/100, grade A — 0 critical, 0 high.** Before this phase it was 63/100
(grade C) with 20 critical and 32 high findings, almost all of them missing
prompt-defense declarations in the instruction files.

## Accepted findings

These stay in the baseline deliberately. Each one is a decision, not an
oversight; re-check them whenever the baseline is re-recorded.

| Finding                                       | File                                               | Why it is accepted                                                                                                                                                                                              |
| :-------------------------------------------- | :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No permissions block / no PreToolUse hooks    | `.vscode/settings.json`, `.vscode/extensions.json` | Scanner heuristic: it treats any `settings.json` / `extensions.json` as agent configuration. These are plain VS Code editor files (a CSS lint rule and a list of recommended extensions) with no agent surface. |
| Repository Codex config overrides user policy | `.codex/config.toml`                               | True, and intentional: the repository config pins the Supabase MCP server to an exact version and forces `--read-only`. It tightens the user policy, never loosens it.                                          |
| No Stop hook                                  | `.claude/settings.local.json`                      | The Stop hook lives in `.claude/settings.json`, which is versioned and applies to everyone. Settings files merge, so declaring it again here would just run the hook twice.                                     |

## Notes for whoever changes the agent surface

- The defense block ("Prompt Security Boundaries") is duplicated in every
  instruction file on purpose: the scanner — and a model reading only that file
  — checks each file on its own.
- The scanner matches regular expressions. **Quoting an attack string inside a
  defense counts as an injection finding.** Describe the defense without
  reproducing the attack. The force-push ban in `CLAUDE.md` is worded that way
  for the same reason.
- Permission rules are enumerated rather than wildcarded: a single
  `Bash(pnpm *)` used to allow both `pnpm dlx` (arbitrary downloaded code) and
  `pnpm db:push` (forbidden against production). Both are now in the deny list.
