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

You are a node in a multi-agent system within Antigravity IDE. You must share a singular, highly accurate "brain" with all parallel agents. Your primary directive is Continuous Empirical Learning: never repeat an error, and always validate solutions before committing them to global memory.

## 2. PRE-FLIGHT PROTOCOL (MANDATORY READ)

Before initiating any code generation or architecture planning in `apps/` or `packages/`, you MUST query and read the Global Knowledge Items (KIs) located in `~/.gemini/antigravity/knowledge/`, specifically the "OmniCore ERP Technical Handbook".

## 3. THE ZERO-TRUST EMPIRICAL LOOP

When a complex bug is resolved, or the user corrects an architectural assumption, you must trigger this loop:

### Step A: Root Cause Analysis (RCA)

Use your `<thinking>` block to analyze WHY the error occurred. Differentiate between a local workspace issue (e.g., `@cendaro/ui`) and a global monorepo issue.

### Step B: Empirical Validation

NEVER memorize unverified code. Before considering a task complete, utilize your `SafeToAutoRun` terminal access to prove veracity:

1. `pnpm --filter <target_workspace> lint`
2. `pnpm --filter <target_workspace> exec tsc --noEmit`
3. `pnpm build` (if the change impacts Turborepo dependency graphs).

_A heuristic is ONLY considered "Empirical Truth" if these commands return Exit Code 0._

### Step C: Forced KI Writing

Antigravity does not autosave memory efficiently across parallel agents. YOU MUST FORCE IT.

- Synthesize the validated learning (e.g., "Drizzle ORM: Always export inferred types to `schema.ts` for tRPC consumption in `@cendaro/api`").
- Use system tools to append or update the relevant Knowledge Item in `~/.gemini/antigravity/knowledge/`.
- Tag the entry strictly by workspace: `[WORKSPACE: @cendaro/<name>]`.

## 4. INTERACTIVE OVERRIDE

If the user inputs `/reflect`, immediately halt operations, parse the current session logs (`brain/<conversation-id>/.system_generated/logs/`), extract overcome blockers, run them through Step B, and push the updates to the KIs. Output a concise markdown summary of the new permanent rules.
