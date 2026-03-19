# GEMINI.md and Rules Templates

# Optimized for Claude Opus 4.6 Adaptive Thinking in Google Antigravity

These templates are designed knowing exactly how Opus 4.6 Adaptive Thinking processes instructions:

- Opus self-decomposes tasks — don't write procedural steps
- Adaptive thinking allocates reasoning budget based on constraint complexity — write tight constraints
- Interleaved thinking between tool calls is automatic — give it outcome goals, not micro-instructions
- The model revisits its own reasoning before acting — binary verifiers let it self-check

---

## ~/.gemini/GEMINI.md — Global Rules (Opus 4.6 Adaptive Thinking)

**When to use**: Personal coding standards that apply across all your projects.
**Effect**: Loaded before every agent action in Antigravity, on all workspaces on this machine.
**⚠️ Gemini CLI conflict**: This file is shared with Gemini CLI. If you use both tools, put
Antigravity-specific rules in project-level `GEMINI.md` or `.agent/rules/` instead.

> **⛔ PROTECTION: If `~/.gemini/GEMINI.md` already exists, NEVER overwrite it.**
> The user's existing file contains their Context Hydration Protocol (agent bootstrap system).
> Instead, propose a merge: show the existing content and this template side by side, and let
> the user decide what to keep, combine, or discard.

```markdown
# Global Agent Rules — Claude Opus 4.6 Adaptive Thinking

## Task Intake Protocol

Before acting on any request, evaluate:

1. **Intent**: Classify as BUILD / FIX / REFACTOR / TEST / MIGRATE / ANALYZE / DEVOPS / MULTI
2. **Scope**: Identify the specific files and modules affected — do not assume broad scope
3. **Constraints**: Extract what must not change (types, tests, APIs, existing behavior)
4. **Verifier**: Determine how completion will be confirmed — must be binary and self-checkable

This evaluation is internal — do not narrate it. Use the result to shape your execution plan.

## Mode Selection

Use **Planning Mode** when: task spans 3+ files, involves architectural decisions,
has irreversible effects, modifies shared interfaces, or requires browser verification.

Use **Fast Mode** when: task is isolated to 1-2 files, change is clearly bounded, easily reversible.

When uncertain: default to Planning Mode and generate a Task List before touching code.

## Context Awareness

Prioritize information from `@`-injected files over any assumed knowledge.
When context is ambiguous: resolve using the workspace file tree before asking.
Ask only when context is genuinely insufficient — state the specific missing information.

## Execution Standards

- TypeScript: zero `any` types unless the task explicitly involves type relaxation
- Tests: all passing tests must remain passing — run after every change, report failures
- Dependencies: no new packages without explicit user approval
- Scope: never modify files outside the stated scope without flagging it first
- Artifacts: never leave debug logs, commented-out code, or TODO placeholders
- Diffs: show a summary of changes before applying to existing files

## Artifact Standards

In Planning Mode, generate the Implementation Plan before writing any code.
In the Walkthrough, include the exact command the user should run to verify the result.
For UI changes: trigger the browser subagent to capture a screenshot or recording.

## Prohibited Patterns

Never produce:

- `catch(e) { console.error(e) }` — handle errors specifically with typed catch blocks
- Hardcoded credentials, tokens, or environment-specific values in any file
- Magic numbers or strings without named constants
- Functions exceeding 40 lines without decomposition into named sub-functions
- `@ts-ignore` or `@ts-expect-error` without an explicit justification comment
- Mutations of function arguments
- Implicit `any` from missing return types on exported functions
```

---

## GEMINI.md — Project-Level Rules

**Location**: `[project-root]/GEMINI.md`
**Effect**: Applies to all agents working in this workspace. Commit to share with team.
**Takes precedence over**: `.agent/rules/` · `AGENTS.md`

> **⛔ PROTECTION: If `[project]/GEMINI.md` already exists, check its contents first.**
> Propose a merge if the file already has content. Never silently overwrite.

Fill in the `[PROJECT]` sections for your stack:

```markdown
# [Project Name] — Agent Rules (Claude Opus 4.6 Adaptive Thinking)

## Task Intake Protocol

Before acting: classify intent, identify scope (specific files), extract constraints, define verifier.
Execute the enhanced version internally — do not narrate the intake process.

## Tech Stack

Framework: [Next.js 15 App Router / React 19 / Nuxt 4 / etc.]
Language: [TypeScript 5.x — strict mode]
Styling: [Tailwind CSS v4 / shadcn/ui / etc.]
State: [Zustand / TanStack Query v5 / Jotai / etc.]
Testing: [Vitest + Testing Library / Jest / Playwright]
Backend: [Node.js / Supabase / tRPC / Hono / etc.]
Package mgr: [pnpm / npm / bun]
ORM/DB: [Drizzle / Prisma / Supabase / etc.]

## File Conventions

Components: src/components/[feature]/[ComponentName].tsx
Hooks: src/hooks/use[Name].ts
Server actions: src/actions/[name].action.ts
Types: src/types/[domain].types.ts
Utils: src/utils/[name].utils.ts
Tests: co-located as [file].test.ts or [file].spec.ts
API routes: src/app/api/[route]/route.ts (App Router)

## Mode Selection

Planning Mode: 3+ files, schema changes, auth/security, public API changes, DB migrations
Fast Mode: UI copy, single-function fix, adding a constant, renaming within one file

## Scope Rules

- Do not modify [next.config.ts / tsconfig.json / tailwind.config.ts] without explicit instruction
- Do not add npm packages without user confirmation
- Database migrations require Planning Mode + user approval before executing
- Do not modify test files except to update them when a public API changes

## Execution Standards

- TypeScript strict: zero `any`, no `@ts-ignore` without justification comment
- All tests must pass after every change: `[test command]`
- Zero lint errors: `[lint command]`
- Server components are async by default — never add `"use client"` unless interactivity requires it

## Verification Standard

Every Planning Mode task is complete only when:

1. `[build command]` exits 0
2. `[test command]` exits 0
3. `[lint command]` exits 0
4. Walkthrough includes the exact command to verify the feature works
```

---

## .agent/rules/prompt-enhancer.md — Modular Rule (Prompt Enhancement Only)

**Location**: `.agent/rules/prompt-enhancer.md` (inside project directory)
**Effect**: One file in the `.agent/rules/` folder. Antigravity loads all `.md` files in this folder.
**Use when**: You want the enhancer as one modular rule alongside other focused rule files.

```markdown
# Prompt Enhancement Protocol

## Task Intake

Before acting on any user request, internally evaluate:

- INTENT: BUILD / FIX / REFACTOR / TEST / MIGRATE / ANALYZE / DEVOPS
- TARGET: Specific files in scope (prefer @-referenced files for ground truth)
- OUTCOME: What must be true when done — one sentence, action + deliverable
- CONSTRAINTS: What must not change, break, or be introduced
- VERIFIER: Binary check the agent can run to confirm completion

Use the evaluation result to shape execution. Do not narrate it.

## Adaptive Thinking Engagement

State hard constraints explicitly — especially ones in tension with each other.
This gives the adaptive thinking process meaningful problems to reason through.

Do not pre-sequence steps. Generate the execution plan internally based on the outcome + constraints.

## Mode Rules

Planning: task spans 3+ files, architectural, irreversible, or browser-verifiable
Fast: isolated to 1-2 files, clearly bounded, easily reversible

## Non-Negotiables

- Run tests after every change and report failures before proceeding
- Never modify files outside the stated scope
- Show a diff summary before applying changes to existing files
- Walkthrough must include a runnable verification command
```

---

## AGENTS.md — Cross-Tool Rules (Antigravity + Cursor + Claude Code)

**Location**: `[project-root]/AGENTS.md`
**Effect**: Loaded by Antigravity, Cursor, Claude Code, Codex. Use for standards that apply everywhere.

```markdown
# Agent Rules — Cross-Tool Standards

## Task Intake Protocol

Before acting on any request, evaluate: intent type, file scope, constraints, and binary verifier.
Act on the enriched version internally — do not explain the intake process.

## Shared Code Standards

[Paste the Execution Standards and Scope Rules from your project GEMINI.md]

## Antigravity-Specific

- Use Planning Mode for tasks spanning 3+ files
- Generate Implementation Plan before writing code
- Use browser subagent to verify UI changes
- Trigger Walkthrough with runnable verification command

## Claude Code-Specific

- Include file path references in all responses
- Run tests after every code change
- Use TodoWrite to track multi-step tasks

## Cursor-Specific

- Follow .cursorrules if present — AGENTS.md takes precedence on conflicts
```

---

## Installation Instructions

### ~/.gemini/GEMINI.md (Global)

**Bash (macOS/Linux):**

```bash
mkdir -p ~/.gemini
nano ~/.gemini/GEMINI.md   # or: code ~/.gemini/GEMINI.md
# Restart Antigravity — rules load on IDE start
```

**PowerShell (Windows):**

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\.gemini" -Force
notepad "$env:USERPROFILE\.gemini\GEMINI.md"   # or: code "$env:USERPROFILE\.gemini\GEMINI.md"
# Restart Antigravity — rules load on IDE start
```

### GEMINI.md (Project root)

```bash
# From the root of your project
nano GEMINI.md   # or: code GEMINI.md

# Commit to share with team
git add GEMINI.md
git commit -m "feat: add Antigravity agent rules for Opus 4.6"
```

### .agent/rules/ (Modular)

```bash
mkdir -p .agent/rules
nano .agent/rules/prompt-enhancer.md

git add .agent/rules/
git commit -m "feat: add modular Antigravity prompt enhancer rule"
```

### Verify rules loaded in Antigravity

Antigravity IDE → `...` (top right) → **Customizations** → **Rules** tab
Global rules appear under "Global", workspace rules appear under "Workspace".

---

## Rules and Skills Loading Hierarchy in Antigravity

When multiple rule and skill files exist, Antigravity applies them in this priority order (highest first):

```
~/.gemini/GEMINI.md              ← highest priority (global personal rules)
~/.gemini/skills/*/SKILL.md      ← global skills (loaded on description match)
[project]/GEMINI.md              ← project-level Antigravity rules
[project]/.agent/rules/          ← modular workspace rules (all .md files loaded)
[project]/.agent/skills/         ← workspace-level skills (loaded on description match)
[project]/AGENTS.md              ← cross-tool rules (lowest priority)
```

On conflict, higher-priority rules win. Rules do not cancel each other — they stack,
with the higher-priority version taking precedence on the specific conflicting instruction.
