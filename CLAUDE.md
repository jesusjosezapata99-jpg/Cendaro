# Cendaro ERP — Claude Code Project Instructions

> This file is the single source of truth for Claude Code. It is read automatically at the start of every session.

## Project Identity

- **Product**: Cendaro ERP — enterprise-grade omnichannel ERP for wholesale + retail commerce
- **Brand**: Cendaro
- **Type**: pnpm monorepo + Turborepo
- **Stack**: Next.js 16 · React 19 · TypeScript 5.9 · Tailwind CSS 4.2 · tRPC v11 · Drizzle ORM · Supabase
- **Package Manager**: `pnpm` — **NEVER** use `npm`, `yarn`, or `bun`
- **Node**: ≥20.0.0
- **Supabase Project ID**: `ljwoptpaxazqmnhdczsb`
- **Deployment**: Vercel Edge

## Monorepo Structure

```
apps/erp/            → Next.js 16 ERP frontend (@cendaro/erp)
packages/api/        → tRPC v11 router layer (@cendaro/api)
packages/auth/       → Supabase SSR auth helpers (@cendaro/auth)
packages/db/         → Drizzle ORM v0.45 schema + queries (@cendaro/db)
packages/ui/         → shadcn/ui + Radix UI components (@cendaro/ui)
packages/validators/ → Zod v4 schemas (@cendaro/validators)
tooling/eslint/      → Shared ESLint v9 flat configs
tooling/prettier/    → Shared Prettier config
tooling/tailwind/    → Shared Tailwind CSS v4 config
tooling/typescript/  → Shared TSConfig
```

## Project Commands

```bash
pnpm dev          # Start all workspaces (Turbo watch)
pnpm dev:erp      # Start ERP only (Turbopack)
pnpm build        # Production build (all workspaces)
pnpm typecheck    # TypeScript check (all workspaces)
pnpm lint         # ESLint (all workspaces)
pnpm lint:fix     # ESLint with --fix
pnpm format       # Prettier check
pnpm format:fix   # Prettier with --write
pnpm test         # Vitest unit tests
pnpm db:push      # Push Drizzle schema to Supabase
pnpm db:studio    # Open Drizzle Studio
pnpm db:generate  # Generate Drizzle migrations
pnpm ui-add       # Add shadcn/ui components
```

---

## Context Hydration (Targeted & On-Demand)

**Read files selectively based on task scope to avoid context bloat:**

1. `graphify query "<question>"` / `/graphify` — Query the local AST graph for symbols, callers, and file relationships (zero-token AST discovery).
2. `.gemini/knowledge/state.md` — Recent changes, active decisions, living memory.
3. `.gemini/knowledge/architecture.md` — Consult selectively for system topology and dependency graph.
4. `.gemini/knowledge/stack.md` — Consult before adding or upgrading dependencies.
5. `graphify-out/GRAPH_REPORT.md` — Consult ONLY for broad architecture review if query/path/explain do not surface enough context (never dump on turn 1).

> ⚡ **Token Economy Rule**: Ingest only the specific section required for the task. Use Graphify for structural navigation.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## ⚠️ Git Guardrails (MANDATORY)

- **NEVER run `git commit` autonomously** — only when the user explicitly asks
- **NEVER run `git push` autonomously** — only when the user explicitly asks
- **NEVER run `git push --force` or `git push -f`** — absolutely prohibited
- You MAY run `git status`, `git diff`, `git log`, `git add` freely
- When asked to "save changes", stage files only (`git add`) — do NOT commit

---

## 🔒 MCP Write Guardrails (MANDATORY — SUPABASE)

> The Supabase MCP has access to the production database.
> Every write operation is a real mutation against live data.

### The Golden Rule

**NEVER execute a write/mutate/create/update/delete operation through any MCP without EXPLICIT user approval.**

### Pre-Execution Protocol (MANDATORY for ALL write operations)

Before calling ANY MCP tool that creates, updates, deletes, or mutates data, you MUST:

1. **📋 ANNOUNCE** — State clearly: _"I'm about to execute a WRITE operation via Supabase MCP"_
2. **🔍 EXPLAIN** — Describe exactly what will change (resource, payload, current vs new state)
3. **⚠️ REVERSIBILITY** — State: ✅ Reversible / ⚠️ Partially reversible / 🚫 Irreversible
4. **🛑 WAIT** — Ask: _"¿Procedo con esta operación? (sí/no)"_ — and STOP until user responds

### Risk Classification

| Risk        | Operations                                                    | Verification                                      |
| :---------- | :------------------------------------------------------------ | :------------------------------------------------ |
| 🔴 CRITICAL | DDL (DROP/ALTER), RLS changes, function/trigger modifications | Double verification — re-read resource, ask AGAIN |
| 🟡 HIGH     | INSERT into auth tables, bulk UPDATE/DELETE                   | Show before/after diff                            |
| 🟢 STANDARD | SELECT queries, read-only operations                          | No confirmation needed                            |

### Supabase Safety

- **Project ID**: `ljwoptpaxazqmnhdczsb` (Cendaro)
- **NEVER** target project `xlgyogcaflsmmwpcuiwk` (SvartxLab — different project)
- Always verify project ID before any MCP operation

---

## MCP Tool Guide

| Tool                  | When to use                                                                                                     |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------- |
| `context7`            | Fetch up-to-date docs for Next.js, Supabase, tRPC, Drizzle, Tailwind, React, shadcn/ui                          |
| `sequential-thinking` | Complex multi-step reasoning, architecture decisions, debugging multi-layer issues — invoke BEFORE writing code |
| `supabase`            | Read-only access to Supabase project `ljwoptpaxazqmnhdczsb`. ⚠️ Write ops require user approval                 |

### Sequential Thinking Protocol

When facing complex problems (multi-file refactoring, architectural decisions, debugging multi-layer issues):

1. Start with an initial scope estimate
2. Revise as understanding deepens
3. Branch when multiple approaches seem viable
4. Set `nextThoughtNeeded: false` only when you have a clear execution path

### Context7 Documentation Protocol

Always use Context7 MCP when needing library/API documentation. Prefer Context7 over web searches for: Next.js, Supabase, tRPC, Drizzle ORM, Tailwind CSS, React, shadcn/ui.

---

## Coding Standards

> Full standards: `.claude/rules/coding-standards.md` (loaded automatically by Claude Code)

**Key rules (quick reference):**

- TypeScript strict — zero `any`, zero `@ts-ignore`
- `~/` alias in ERP app — no `../../` climbing
- Workspace refs between packages: `@cendaro/api`, `@cendaro/db`, etc.
- Zod v4 import: `from 'zod/v4'` (not `from 'zod'`)
- Server Components by default — `"use client"` only when needed
- tRPC for all data fetching — never raw `fetch` to internal APIs
- `pnpm exec` prefix for all tool binaries — never bare `eslint`, `prettier`, `tsc`
- Windows PowerShell syntax — never bash/Unix commands

---

## Subagents

Custom specialist agents in `.claude/agents/`. Invoke by name or `@-mention`.

| Agent            | Model | Purpose                                             | Memory     |
| :--------------- | :---- | :-------------------------------------------------- | :--------- |
| `code-reviewer`  | opus  | Pre-commit quality + security audit                 | ✅ project |
| `debugger`       | opus  | Root cause analysis for errors                      | ✅ project |
| `researcher`     | opus  | Read-only codebase exploration                      | ✅ project |
| `test-runner`    | opus  | Run and fix tests (Vitest)                          | ✅ project |
| `supabase-guard` | opus  | Read-only DB queries (SQL writes blocked)           | ❌         |
| `browser-tester` | opus  | Visual/functional browser testing via agent-browser | ✅ project |

**Usage**: `@"code-reviewer (agent)" review auth changes` or `Use the debugger to fix this error`

---

## Skills & Commands

### Available Skills (use `/project:project-skills` for full catalog)

- `/project:coding-review` — Pre-commit quality checks
- `/project:memory-sync` — Post-task memory synchronization
- `/project:create-plan` — Scaffold plan in `.opencode/plans/`
- `/project:create-report` — Scaffold report in `.opencode/reports/`
- `/project:project-skills` — Browse all available skills

### Quick Commands

- `/project:typecheck` — Run `pnpm typecheck`
- `/project:dev` — Start ERP dev server
- `/project:hydrate` — Read all context files
- `/project:db-studio` — Open Drizzle Studio

### Hooks (automatic)

- **graphify-auto-sync** — Graphify automatically updates on post-commit, post-checkout, post-merge, and in dev-mode filesystem watcher.
- **graphify-reminder** — Reminds about knowledge graph before shell commands
- **auto-lint** — Runs ESLint asynchronously after file writes
- **validate-readonly-query** — Blocks SQL writes for `supabase-guard` agent

### Browser Automation

- `agent-browser` CLI installed globally — native Rust browser automation
- Skills: `agent-browser skills get core --full` for command reference
- Web Vitals: `agent-browser vitals <url>`

---

## Post-Task Protocol (Living Memory)

After completing any significant task:

1. **Always**: Prepend timestamped entry to `.gemini/knowledge/state.md`
2. **On structural changes**: Update `.gemini/knowledge/architecture.md`
3. **On dependency changes**: Update `.gemini/knowledge/stack.md` (verify from `package.json`)
4. **File artifacts**: Plans → `.opencode/plans/PLAN-[NAME].md`, Reports → `.opencode/reports/[CATEGORY]-REPORT-[NAME].md`

**NEVER** save plans or reports to project root, `/docs/`, `/tmp/`, or any ad-hoc path.

---

## Violation Protocol

If you realize you executed a write operation WITHOUT user approval:

1. IMMEDIATELY inform the user what was executed
2. Provide the exact data that was written/changed
3. Offer the reversal command if available
4. Log it in `.gemini/knowledge/state.md` as a critical guardrail violation
