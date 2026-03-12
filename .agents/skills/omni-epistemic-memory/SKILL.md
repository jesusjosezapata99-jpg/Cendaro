---
name: omni-epistemic-memory
description: "Omni-Agent Epistemic Sync & Empirical Memory — enforces shared memory, zero-trust empirical validation, and forced KI writing across all parallel agents."
allowed-tools:
  - "Read"
  - "Write"
  - "Terminal"
---

# SKILL: OMNI-AGENT EPISTEMIC SYNC & EMPIRICAL MEMORY

## 1. SYSTEM OBJECTIVE

You are a node in a multi-agent system. You must share a singular, highly accurate "brain" with all parallel agents. Your primary directive is Continuous Empirical Learning: never repeat an error, and always validate solutions before committing them to global memory.

**This skill is agent-neutral** — it applies to all agents using this monorepo.

- **Gemini/Antigravity**: Reads rules from `.gemini/rules.md`

All agents share `.agents/skills/omni-epistemic-memory/error-log.md` as the **single source of truth**.

## 2. PRE-FLIGHT PROTOCOL (MANDATORY READ)

Before initiating any code generation or architecture planning in `apps/` or `packages/`, you MUST:

1. Read the **Error Log** at `.agents/skills/omni-epistemic-memory/error-log.md` — focus on the Quick Reference table.
2. Read the **Error Prevention Matrix** in Section 5 below.
3. Cross-reference your current task against known error patterns before writing any code.

## 3. THE ZERO-TRUST EMPIRICAL LOOP

When a complex bug is resolved, or the user corrects an architectural assumption:

### Step A: Root Cause Analysis (RCA)

Analyze WHY the error occurred. Classify:

- **Local**: Workspace-specific issue (e.g., `@cendaro/ui` exports mismatch)
- **Global**: Monorepo-wide issue (e.g., missing root devDependency)
- **Platform**: Windows-specific (e.g., PATH resolution, command syntax)

### Step B: Empirical Validation

NEVER memorize unverified code. Verify with:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm build` (if change impacts Turborepo graph)

Exit Code 0 = Empirical Truth. Anything else = not verified.

### Step C: Forced KI Writing

Update the relevant Knowledge Item. Tag by workspace: `[WORKSPACE: @cendaro/<name>]`.

### Step D: Error Log Update (MANDATORY)

Append to `.agents/skills/omni-epistemic-memory/error-log.md`:

```markdown
### [YYYY-MM-DD] Brief Title

- **Error**: What failed
- **Root Cause**: Why it failed
- **Fix**: What was done
- **Prevention**: Rule to avoid recurrence
- **Workspace**: Which package(s) were affected
- **Severity**: Critical / Major / Minor
- **Recurrence**: 1st (or Nth — cross-reference Quick Reference table)
```

Also update the Quick Reference table if the error represents a new pattern.

## 4. INTERACTIVE OVERRIDE

If the user inputs `/reflect`, immediately:

1. Parse the current session for overcome blockers
2. Run each through Step B validation
3. Push validated learnings to KIs and error-log.md
4. Output a markdown summary of new permanent rules

## 5. ERROR PREVENTION MATRIX

| Error Pattern                         | Root Cause                           | Prevention Rule                                                        |
| ------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| ESLint fails in lint-staged from root | No root `eslint.config.ts`           | Root config must exist with `defineConfig(baseConfig)`                 |
| `pnpm exec <cmd>` not found           | Missing root devDependency           | Add tool to root `package.json` devDependencies                        |
| TypeScript ↔ ESLint `?.` conflict     | Types pessimistic, ESLint optimistic | Use `?.` + `eslint-disable` comment                                    |
| Import from shared package breaks     | `exports` path mismatch              | Verify `exports` field matches actual file extensions                  |
| Pre-push typecheck fails              | Broken types committed               | Run `pnpm typecheck` before committing                                 |
| `FUNCTION_PAYLOAD_TOO_LARGE`          | Raw file to Vercel serverless        | Client-side parsing + chunked JSON upload                              |
| Stale KI refs deprecated packages     | No pruning after upgrades            | Run `/memory-audit` after dependency changes                           |
| Wrong Supabase project                | Multiple projects                    | Verify `project_id = ljwoptpaxazqmnhdczsb`                             |
| Bare commands fail on Windows         | Not in PATH                          | Always use `pnpm exec` prefix                                          |
| Rules invisible to other agents       | Single config file                   | Maintain `.gemini/rules.md` and `.agents/skills/` as shared references |
| `npx skills add` cross-contamination  | CLI not monorepo-aware               | NEVER use `npx skills add` — git clone + manual copy only              |
| Uncommitted changes before handoff    | Working tree dirty on handoff        | Always commit + push BEFORE handing off to user                        |

## 6. MCP SERVER CONTEXT

| Server       | Project Context                                                                    |
| ------------ | ---------------------------------------------------------------------------------- |
| **Supabase** | Project: `ljwoptpaxazqmnhdczsb` (Cendaro). Block: `xlgyogcaflsmmwpcuiwk` (Svartx). |
| **Stripe**   | Payments/billing features.                                                         |
| **Stitch**   | UI design generation. Use with `stitch-loop` + `design-md` skills.                 |

## 7. POST-TASK SYNCHRONIZATION PROTOCOL (MANDATORY)

> **This protocol is NON-OPTIONAL.** Every agent MUST execute the applicable steps below after completing any significant task. Failure to synchronize means the next agent session loses your learnings.

### A) STATE UPDATE — Always

Prepend a timestamped entry to `.gemini/knowledge/state.md` Progress Log with:

```markdown
### [YYYY-MM-DD] Brief Title of What Was Done

- **Files changed**: list of created, modified, or deleted files
- **Decisions**: any architectural or design decisions made
- **Health**: current project health status after this change
```

Also:

- Increment the **Session Count** in the Session Registry section
- Update the **Last Modified By** field with the agent name and ISO 8601 timestamp

### B) ERROR LOG UPDATE — When Bugs Are Fixed

Append to `.agents/skills/omni-epistemic-memory/error-log.md` using the template in Section 3D. Required fields:

- All standard fields (Error, Root Cause, Fix, Prevention, Workspace)
- **Severity**: `Critical` (build-breaking) / `Major` (feature-breaking) / `Minor` (cosmetic or DX)
- **Recurrence**: `1st` if new pattern, or `Nth` if it matches an existing Quick Reference rule (cite the rule number)

Also update the Quick Reference table and the Statistics section.

### C) ARCHITECTURE UPDATE — When Structure Changes

If the task involved creating or modifying any of the following, update `.gemini/knowledge/architecture.md`:

- New packages or workspace modules
- New route groups in `apps/erp/src/app/`
- New tRPC routers in `packages/api/src/modules/`
- New external service integrations
- Changes to the inter-package dependency graph

Update Mermaid diagrams if the topology changed.

### D) STACK UPDATE — When Dependencies Change

If new dependencies were installed or versions changed:

1. Read the actual version from the relevant `package.json` or `pnpm-workspace.yaml` catalog — **NEVER guess**
2. Update `.gemini/knowledge/stack.md` with the new or modified entry
3. Update the "Dependency Change Log" section in `.gemini/knowledge/state.md`

### E) RULES UPDATE — When New Patterns Are Discovered

If the task revealed a new error pattern or prevention rule:

1. Add the pattern to the Error Prevention Matrix in `.gemini/rules.md`
2. Add the pattern to the Error Prevention Matrix in this file (Section 5)
3. Update the Quick Reference table in `.agents/skills/omni-epistemic-memory/error-log.md`
4. Ensure all three tables remain **fully synchronized**

## 8. SELF-LEARNING FEEDBACK LOOP

> **The system learns only if agents actively cross-reference before acting.**

### Pre-Task Cross-Reference (MANDATORY)

Before starting ANY code-modifying task:

1. Read `.agents/skills/omni-epistemic-memory/error-log.md` — focus on the **Quick Reference** table
2. Read the **Error Prevention Matrix** in `.gemini/rules.md`
3. Compare your current task against every known pattern
4. If your task matches a known pattern → **follow the documented prevention rule FIRST** before writing any code

### Pattern Interruption Protocol

If during execution you catch yourself about to repeat a logged error:

1. **STOP immediately** — do not proceed with the error-prone approach
2. Read the full entry for the matching error pattern in the error log
3. Follow the documented prevention rule exactly
4. Note in your state.md update that the self-learning loop prevented a repeat error

### New Error Discovery Protocol

If you discover a new class of error NOT in the existing matrices:

1. Fix the immediate issue
2. Validate: `pnpm lint && pnpm typecheck && pnpm build` — all must exit 0
3. Add the new pattern to ALL THREE locations:
   - `.agents/skills/omni-epistemic-memory/error-log.md` (full entry + Quick Reference)
   - `.gemini/rules.md` Error Prevention Matrix
   - Section 5 Error Prevention Matrix (this file)
4. Update `.gemini/knowledge/state.md` Progress Log documenting the discovery
5. Classify severity and check for recurrence against existing entries
