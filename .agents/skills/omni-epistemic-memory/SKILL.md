---
name: omni-epistemic-memory
description: >
  Omni-Agent Epistemic Sync & Empirical Memory for the Cendaro ERP monorepo.
  Enforces shared memory, zero-trust empirical validation, and forced knowledge
  writing across all agent sessions. ALWAYS activate when: starting any task in
  this monorepo; a blocking bug has been resolved; the user types /reflect;
  a task spans multiple files or packages; any architectural, schema, dependency,
  or structural change occurs; the agent detects it is about to repeat a known
  error pattern. This skill is the agent's brain — it must be read before acting
  and written to after acting. Never skip it.
allowed-tools:
  - Read
  - Write
  - Terminal
---

# OMNI-AGENT EPISTEMIC SYNC — Cendaro ERP

## Claude Opus 4.6 Adaptive Thinking Edition

---

## System Context

**Project**: Cendaro ERP — pnpm monorepo + Turborepo  
**OS**: Windows (PowerShell) — never use bash/Unix syntax  
**Agent**: Claude Opus 4.6 Adaptive Thinking — single agent in Antigravity  
**Supabase**: `ljwoptpaxazqmnhdczsb` (Cendaro ✅) | `xlgyogcaflsmmwpcuiwk` (Svartx 🚫 NEVER)

### Knowledge File Map

| File                                                | Role                                                        | When to read                                    |
| --------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| `.agents/skills/omni-epistemic-memory/error-log.md` | Single source of truth — all error history                  | **Every session start, before any code change** |
| `.gemini/rules.md`                                  | Mandatory agent rules, approved commands, forbidden actions | Every session start                             |
| `.gemini/knowledge/architecture.md`                 | Full system topology + Mermaid diagrams                     | Before any architectural or structural change   |
| `.gemini/knowledge/stack.md`                        | Exact technology versions (empirically verified)            | Before adding/changing any dependency           |
| `.gemini/knowledge/state.md`                        | Rolling session log — what was done and when                | When picking up from a previous session         |

### Workflow Map

| Command            | File                                   | When to invoke                                                              |
| ------------------ | -------------------------------------- | --------------------------------------------------------------------------- |
| `/dep-audit`       | `.agents/workflows/dep-audit.md`       | After any dependency change                                                 |
| `/memory-audit`    | `.agents/workflows/memory-audit.md`    | After dependency upgrades or major refactors                                |
| `/prd-sync`        | `.agents/workflows/prd-sync.md`        | After critical changes (schema, architecture, security, new pages, new API) |
| `/supabase-safety` | `.agents/workflows/supabase-safety.md` | Before any DB operation                                                     |
| `/reflect`         | This skill, Section 5                  | Manual · auto on blocking error resolved · auto at end of long session      |

### Skill Ecosystem

| Skill                   | Path                                    | Used with                         |
| ----------------------- | --------------------------------------- | --------------------------------- |
| `omni-epistemic-memory` | `.agents/skills/omni-epistemic-memory/` | All agents, all tasks             |
| `stitch-loop`           | `.agents/skills/stitch-loop/`           | Stitch MCP — UI design generation |
| `design-md`             | `.agents/skills/design-md/`             | Stitch MCP — design spec writing  |

---

## 1 — Pre-Flight Protocol (MANDATORY before any code change)

Before writing any code, modifying any file, or executing any terminal command:

**Read these files in order:**

1. `.agents/skills/omni-epistemic-memory/error-log.md` — focus on the **Quick Reference** table
2. `.gemini/rules.md` — focus on **Forbidden Actions** and **Error Prevention Matrix**
3. `.gemini/knowledge/architecture.md` — if the task touches structure, packages, or routing
4. `.gemini/knowledge/stack.md` — if the task touches dependencies

**Outcome required before proceeding:**  
Every active Quick Reference rule cross-referenced against the current task.  
If the task matches a known pattern → apply the documented prevention rule first, then proceed.  
If the task matches a known pattern AND you were about to violate it → execute the Pattern Interruption Protocol (Section 6).

---

## 2 — Empirical Validation Standard

**Exit Code 0 = Empirical Truth. Anything else = not done.**

Run in this sequence after every code change:

```powershell
pnpm lint
pnpm typecheck
pnpm build
```

**Windows rules:**

- Never use bare `eslint`, `prettier`, `tsc` — always `pnpm exec` prefix or `pnpm run <script>`
- Never use bash syntax — use PowerShell: `Get-Content` not `cat`, `Remove-Item` not `rm`, `Get-ChildItem` not `ls`
- Never use `pnpm exec tsc --noEmit` with workspace globs — breaks on Windows
- Never run `pnpm test` without confirming test suite is ready

**Supabase MCP safety — verify before every DB operation:**

```
project_id = ljwoptpaxazqmnhdczsb   ✅ Cendaro — safe
project_id = xlgyogcaflsmmwpcuiwk   🚫 Svartx — BLOCKED, never touch
```

---

## 3 — Zero-Trust Empirical Loop

When a blocking bug is resolved or a user corrects an architectural assumption, the following must be true before the session ends:

**The learning is only real when it is written.**

Constraints that define "complete resolution":

- Fix validated: `pnpm lint && pnpm typecheck && pnpm build` all exit 0
- Root cause classified: Local (workspace-specific) · Global (monorepo-wide) · Platform (Windows)
- Error log updated: new entry appended to `.agents/skills/omni-epistemic-memory/error-log.md`
- Quick Reference table updated if the pattern is new
- Prevention matrix synced in `.gemini/rules.md` if the pattern is new

**Error Log Write Failure Protocol:**  
If the agent cannot write to `error-log.md` (file locked, git conflict, permissions):

1. Warn the user immediately with the exact error message
2. Output the complete formatted entry to the conversation so the user can paste it manually
3. Continue with the task — do not block on the write failure

Read `references/sync-protocols.md` for the exact entry format and all update templates.

---

## 4 — Post-Task Synchronization Protocol (NON-OPTIONAL)

**Every significant task is incomplete until the living memory is updated.**  
Failure to sync means the next agent session loses your learnings — this is permanent knowledge loss.

Determine which sync operations apply to the completed task:

### A — State Update (ALWAYS required)

Every significant task requires a Progress Log entry in `.gemini/knowledge/state.md`.

Required outcome:

- New entry prepended to the Progress Log with ISO 8601 timestamp
- Session Count incremented
- Last Modified By updated with agent name + timestamp

### B — Error Log Update (when bugs are fixed)

Append to `.agents/skills/omni-epistemic-memory/error-log.md`.  
Update Quick Reference table if the pattern is new.  
Update Statistics section (totals, severity counts, workspace counts, last entry date).

### C — Architecture Update (when structure changes)

Update `.gemini/knowledge/architecture.md` when:

- New packages or workspace modules created
- New route groups added to `apps/erp/src/app/`
- New tRPC routers added to `packages/api/src/modules/`
- New external service integrations added
- Inter-package dependency graph changes

Update Mermaid diagrams when topology changes.

### D — Stack Update (when dependencies change)

Update `.gemini/knowledge/stack.md` when:

- New dependencies installed
- Existing dependency versions change

Constraint: read the actual version from `package.json` or `pnpm-workspace.yaml` catalog — never guess or assume versions.  
Also update the Dependency Change Log section in `.gemini/knowledge/state.md`.

### E — Rules Update (when new patterns are discovered)

When a new error pattern is identified, all three matrices must be updated and kept in sync:

1. `.agents/skills/omni-epistemic-memory/error-log.md` — full entry + Quick Reference row
2. `.gemini/rules.md` — Error Prevention Matrix row
3. This SKILL.md is NOT a matrix — do not duplicate it here; the single source of truth is the error log

Run `/dep-audit` after dependency changes. Run `/prd-sync` after critical changes.

Full format templates for all sync operations → `references/sync-protocols.md`

---

## 5 — /reflect Protocol

**Three triggers — all produce the same output:**

| Trigger                   | Condition                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Manual**                | User types `/reflect`                                                                          |
| **Auto — blocking error** | A blocking error has been fully resolved and validated (exit code 0) in this session           |
| **Auto — session length** | The session has covered 3 or more significant tasks or has been running for an extended period |

**When /reflect fires:**

1. Parse the current session for all resolved blockers, corrected assumptions, and new patterns discovered
2. For each finding: validate with `pnpm lint && pnpm typecheck && pnpm build` (exit code 0 required)
3. Execute the relevant Post-Task Sync operations (Section 4) for each validated finding
4. Output a markdown summary to the conversation:

```markdown
## /reflect — Session Learning Report

**Date**: [ISO 8601 timestamp]
**Session tasks covered**: [count]

### New rules added

- [Rule description] → written to [file]

### Errors documented

- [Error title] → entry appended to error-log.md

### Knowledge files updated

- [file]: [what changed]

### Patterns that were prevented (self-learning loop fired)

- [Pattern]: was about to [action], caught by Quick Reference rule #[N]
```

If no new learnings exist: output `## /reflect — No new patterns this session.` and stop.

---

## 6 — Self-Learning Feedback Loop

**The system learns only if agents cross-reference before acting AND write after acting.**

### Pre-Task Cross-Reference (mandatory)

Before starting any code-modifying task, the Quick Reference table in `error-log.md` and the Error Prevention Matrix in `rules.md` must be read and compared against the current task. This is already required by the Pre-Flight Protocol (Section 1) — do not skip it.

### Pattern Interruption Protocol

If during execution the agent detects it is about to produce a pattern that matches a known error:

1. **STOP** — do not proceed with the error-prone approach
2. Read the full entry for the matching pattern in `error-log.md`
3. Apply the documented prevention rule exactly
4. Log the interruption in the /reflect session summary under "Patterns that were prevented"

### New Error Discovery Protocol

When a new class of error is discovered that is NOT in any existing matrix:

**Outcome required before marking task done:**

- Immediate fix applied and validated (exit code 0)
- Full entry appended to `error-log.md` (Section 4B)
- Prevention rule added to `rules.md` Error Prevention Matrix (Section 4E)
- Statistics section updated in `error-log.md`
- If the error revealed an architectural insight: `architecture.md` updated

---

## 7 — MCP Server Safety

| Server       | Project Context                  | Safety Rule                                                              |
| ------------ | -------------------------------- | ------------------------------------------------------------------------ |
| **Supabase** | `ljwoptpaxazqmnhdczsb` (Cendaro) | Verify `project_id` before EVERY operation. Block `xlgyogcaflsmmwpcuiwk` |
| **Stripe**   | Payments/billing                 | Use for billing features only                                            |
| **Stitch**   | UI design generation             | Use with `stitch-loop` + `design-md` skills                              |

**Before any Supabase MCP operation:**

- Run `/supabase-safety` workflow
- Pass `project_id: "ljwoptpaxazqmnhdczsb"` explicitly in every tool call
- Destructive operations (DROP, DELETE, schema changes) require user confirmation

---

## Reference Files

| File                           | When to read                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `references/sync-protocols.md` | Whenever writing to error-log.md, state.md, architecture.md, stack.md — contains exact formats and templates |
| `error-log.md`                 | Every session start + before any code change — the Quick Reference table is non-negotiable                   |
