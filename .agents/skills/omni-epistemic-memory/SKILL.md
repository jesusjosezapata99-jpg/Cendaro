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

**This skill is agent-neutral** — it applies identically to:

- **Gemini/Antigravity**: Reads rules from `.gemini/rules.md`
- **Claude Code**: Reads rules from `.claude/CLAUDE.md` + `.claude/rules/*.md`

Both agents share `.agents/skills/omni-epistemic-memory/error-log.md` as the **single source of truth**.

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
```

Also update the Quick Reference table if the error represents a new pattern.

## 4. INTERACTIVE OVERRIDE

If the user inputs `/reflect`, immediately:

1. Parse the current session for overcome blockers
2. Run each through Step B validation
3. Push validated learnings to KIs and error-log.md
4. Output a markdown summary of new permanent rules

## 5. ERROR PREVENTION MATRIX

| Error Pattern                         | Root Cause                           | Prevention Rule                                        |
| ------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| ESLint fails in lint-staged from root | No root `eslint.config.ts`           | Root config must exist with `defineConfig(baseConfig)` |
| `pnpm exec <cmd>` not found           | Missing root devDependency           | Add tool to root `package.json` devDependencies        |
| TypeScript ↔ ESLint `?.` conflict     | Types pessimistic, ESLint optimistic | Use `?.` + `eslint-disable` comment                    |
| Import from shared package breaks     | `exports` path mismatch              | Verify `exports` field matches actual file extensions  |
| Pre-push typecheck fails              | Broken types committed               | Run `pnpm typecheck` before committing                 |
| `FUNCTION_PAYLOAD_TOO_LARGE`          | Raw file to Vercel serverless        | Client-side parsing + chunked JSON upload              |
| Stale KI refs deprecated packages     | No pruning after upgrades            | Run `/memory-audit` after dependency changes           |
| Wrong Supabase project                | Multiple projects                    | Verify `project_id = ljwoptpaxazqmnhdczsb`             |
| Bare commands fail on Windows         | Not in PATH                          | Always use `pnpm exec` prefix                          |
| Rules invisible to other agents       | Single config file                   | Maintain `.claude/CLAUDE.md` + `.gemini/rules.md`      |

## 6. MCP SERVER CONTEXT

| Server       | Project Context                                                                    |
| ------------ | ---------------------------------------------------------------------------------- |
| **Supabase** | Project: `ljwoptpaxazqmnhdczsb` (Cendaro). Block: `xlgyogcaflsmmwpcuiwk` (Svartx). |
| **Stripe**   | Payments/billing features.                                                         |
| **Stitch**   | UI design generation. Use with `stitch-loop` + `design-md` skills.                 |
