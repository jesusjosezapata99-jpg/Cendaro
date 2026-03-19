---
name: prompt-enhancer-antigravity
description: >
  Core prompt engineering layer active on every agent interaction. Intercepts
  and internally enhances any developer message — code tasks, debugging,
  refactoring, analysis, DevOps, testing, migrations, questions, and casual
  instructions — applying structured outcome-constraint-verifier decomposition
  before execution. Operates transparently on all intent types: build, fix,
  refactor, test, migrate, analyze, deploy, and multi-task requests. Works
  across all models with deep optimization for Claude Opus 4.6 Thinking and
  advanced reasoning models. Activates on any coding-related interaction
  including but not limited to: prompt improvement, task delegation,
  architecture questions, code review, workflow creation, rules configuration,
  and IDE customization. Funciona en español e inglés. Mejora cualquier
  instrucción, optimiza prompts, analiza tareas, estructura solicitudes,
  corrige errores, implementa features, refactoriza código, genera tests,
  realiza migraciones, revisa código, crea componentes, configura proyectos,
  despliega aplicaciones, y responde preguntas técnicas de forma profesional.
  Safety triggers: mejora este prompt, optimiza esta instrucción, hazlo más
  profesional, arregla esto, implementa esto, crea esto, analiza esto, revisa
  esto, refactoriza esto, genera tests, enhance this prompt, make it better,
  optimize this, fix this, build this, review this code.
---

# Prompt Enhancer — Optimized for Advanced Reasoning Models

## Antigravity Architecture

Antigravity is Google's **agent-first IDE** (VS Code fork). It is **multi-model**:
models are selectable per conversation and assignable per agent in multi-agent missions.
This skill is optimized for **Claude Opus 4.6 Thinking** and models with advanced reasoning
capabilities, but the enhancement protocol applies universally to all models.

### The 5 Antigravity Systems — understand all before enhancing any prompt

| System            | What it is                                                      | Trigger                         | Storage                                                                                                                      |
| ----------------- | --------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Rules**         | Always-on system instructions — agent reads before every action | Passive, automatic              | `~/.gemini/GEMINI.md` · project `GEMINI.md` · `.agent/rules/*.md`                                                            |
| **Workflows**     | Saved prompt templates triggered on-demand                      | `/workflow-name` in agent panel | `~/.gemini/antigravity/global_workflows/*.md` (global — create dir manually if needed) · `.agent/workflows/*.md` (workspace) |
| **Skills**        | Specialist knowledge packages loaded only on description match  | Auto-triggered                  | `~/.gemini/skills/` (global) · `.agent/skills/` (workspace)                                                                  |
| **MCP**           | External tool integrations (GitHub, Jira, DBs, APIs)            | `@mcp-server-name` in prompt    | `~/.gemini/antigravity/mcp_config.json` (global) · `.agent/mcp_servers.json` (workspace)                                     |
| **Context (`@`)** | Inject files, folders, or MCP servers into prompt scope         | Typed inline at prompt time     | N/A                                                                                                                          |

### The Artifact Pipeline (critical for writing effective prompts)

Every **Planning Mode** task generates these artifacts in sequence. Your prompt must be written
knowing this pipeline exists — a well-formed prompt activates the full review loop:

1. **Task List** → structured plan the agent commits to before touching code
2. **Implementation Plan** → technical architecture of the changes (reviewable, commentable via Google Docs-style inline comments)
3. **Code diffs** → actual changes (commentable line-by-line)
4. **Walkthrough** → summary of what was done + verification steps
5. **Screenshots / Browser Recordings** → visual proof of UI correctness (requires Browser extension)

A poorly written prompt skips the plan entirely and goes straight to code — losing the feedback loop.

### Agent Modes

- **Planning Mode** — full artifact pipeline. Use when: 3+ files affected, architectural impact, irreversible operations, browser verification needed, or task has downstream dependencies.
- **Fast Mode** — executes directly, no artifacts. Use when: 1–2 files, isolated change, trivially reversible.

---

## Claude Opus 4.6 Adaptive Thinking — The Core Insight

This section determines whether a prompt is mediocre or exceptional with Opus 4.6. Read it every time.

### How Adaptive Thinking works

Opus 4.6 uses `thinking: {type: "adaptive"}` — it **self-determines** when and how much to reason
based on task complexity. Effort levels range from low to max. Interleaved thinking between tool
calls is automatic. The model re-evaluates its own reasoning before committing.

**The fundamental rule for prompting Opus 4.6 Adaptive Thinking:**

> Give it the destination and the guardrails. Never give it the route.

| ❌ Counterproductive           | ✅ Effective                                             |
| ------------------------------ | -------------------------------------------------------- |
| Step-by-step instructions      | Goal + hard constraints — Opus self-decomposes           |
| "First do X, then Y, then Z"   | "The outcome must satisfy A and B. Constraints: C, D."   |
| Describing what to think about | Describing what must be true when done                   |
| Procedural detail              | Tension between requirements (triggers deeper reasoning) |
| Vague success ("make it work") | Binary verifier (agent can check programmatically)       |

### What triggers maximum thinking depth in Opus 4.6

Opus allocates deeper reasoning when it detects:

- **Constraint tension** — requirements that pull against each other
- **Ambiguous scope** — needs to reason about what's in vs out before acting
- **Non-obvious constraints** — things that could silently break if not considered
- **Rich context** — large `@` file trees give it more signal to reason against

Write prompts that surface these tensions. Don't pre-solve the problem — Opus will generate a
better decomposition than you can write manually.

### Context injection with `@` — always use it

Opus 4.6 has a 1M token context window. Inject files directly instead of describing them:

```
@src/auth/login.ts @src/types/user.ts @src/middleware/session.ts
[Your enhanced prompt here]
```

This eliminates description error, gives Opus ground truth, and saves tokens on your end.

---

## Enhancement Protocol

### Step 1 — Classify intent

| Type         | Signal words                                    | Artifact pipeline                          | Mode          |
| ------------ | ----------------------------------------------- | ------------------------------------------ | ------------- |
| **BUILD**    | create, implement, add, generate, build         | Task List → Impl Plan → Code → Walkthrough | Plan          |
| **FIX**      | fix, bug, broken, error, crash, failing         | Task List → Code → Walkthrough             | Plan or Fast  |
| **REFACTOR** | refactor, restructure, clean, simplify, extract | Impl Plan → Code                           | Plan          |
| **TEST**     | test, coverage, spec, unit, e2e                 | Task List → Code                           | Fast          |
| **MIGRATE**  | migrate, upgrade, update version, move to       | Full pipeline                              | Plan (always) |
| **ANALYZE**  | explain, audit, review, understand, trace       | Walkthrough only                           | Fast          |
| **DEVOPS**   | deploy, pipeline, CI/CD, Docker, infra          | Full pipeline                              | Plan (always) |
| **MULTI**    | two or more types in one request                | Full pipeline                              | Plan (always) |

### Step 2 — Resolve the 4 Dimensions

Extract these dimensions from the raw prompt. Infer from conversation context when not stated.
**Do NOT pre-write procedural steps** — that is Opus's job and it will do it better.

```
TARGET      → Specific files / modules / functions in scope (prefer @ paths)
OUTCOME     → The exact state that must exist when done — one sentence: action + deliverable
CONSTRAINTS → What must not change, break, or be introduced — enumerate specifically
VERIFIER    → How the agent confirms completion — binary, programmatically checkable
```

### Step 3 — Build the enhanced prompt

Use the corresponding template from `references/templates.md`.

**Rules that apply to every enhanced prompt:**

- ✅ Lead with `@` context injections for all relevant files
- ✅ State the OUTCOME first — what must be true when done
- ✅ State CONSTRAINTS before any implementation detail
- ✅ Make the VERIFIER binary — agent can check it without human judgment
- ✅ Give the goal without dictating steps — Opus self-decomposes
- ✅ Include an explicit out-of-scope boundary
- ✅ Declare mode at the end: `[Planning Mode]` or `[Fast Mode]`
- ❌ No step-by-step instructions
- ❌ No filler: "please", "try to", "I need you to", "as an expert"
- ❌ No vague verifiers: "make sure it works", "test it thoroughly"
- ❌ No context description that can be injected with `@`
- ❌ No duplicate constraints phrased differently

### Step 4 — Output format

```
ENHANCED PROMPT FOR ANTIGRAVITY
────────────────────────────────────────
[The complete enhanced prompt, ready to paste]

TRANSFORMATION
────────────────────────────────────────
Original: "[their raw input]"
Changes:
• [Specific improvement 1 and why it matters for Opus 4.6]
• [Specific improvement 2]
• [Specific improvement 3 if applicable]

MODE: Planning / Fast
ARTIFACTS: [which artifacts this will trigger]
```

If the prompt pattern is reusable (something they'd send repeatedly), append:

```
WORKFLOW OPPORTUNITY
────────────────────────────────────────
This is a repeating pattern. See references/workflows.md to convert it into a
/workflow command for one-keystroke triggering.
```

---

## Native Antigravity Implementation

When the user wants the enhancer to run **automatically** on every message (no copy-paste needed),
generate the appropriate configuration. Read `references/gemini-md-template.md` for full content.

**Scope decision:**

| Use case                         | File to generate                  |
| -------------------------------- | --------------------------------- |
| Personal, all projects           | `~/.gemini/GEMINI.md`             |
| This project + team              | `GEMINI.md` in project root       |
| Modular rules by concern         | `.agent/rules/prompt-enhancer.md` |
| Cross-tool (Cursor, Claude Code) | `AGENTS.md` in project root       |
| Repeatable specific task         | `.agent/workflows/[task-name].md` |

**⚠️ Gemini CLI conflict warning:** `~/.gemini/GEMINI.md` is shared between Antigravity and
Gemini CLI. If the user has both tools, recommend project-level `GEMINI.md` or `.agent/rules/`
to prevent configuration bleed between tools.

---

## ⛔ GEMINI.md Protection Directive

This skill contains reference templates for generating GEMINI.md content
(see `references/gemini-md-template.md`). These templates are PASSIVE —
they are only read when the user explicitly requests GEMINI.md generation.

**Non-negotiable rules:**

1. **NEVER** overwrite, replace, or modify an existing `~/.gemini/GEMINI.md`.
   This file contains the user's Context Hydration Protocol (agent bootstrap
   system) and is a critical system-level directive.

2. If the user asks to generate global GEMINI.md content and `~/.gemini/GEMINI.md`
   already exists: **propose a merge**. Show the existing content and the new
   content side by side. Let the user decide what to keep, combine, or discard.

3. For project-level GEMINI.md (`[project]/GEMINI.md`): check if the file
   exists first. If it does, propose a merge. If it doesn't, create it freely.

4. The templates in `references/gemini-md-template.md` are starting points,
   not overwrite instructions. Always adapt to the user's existing setup.

---

## Quality Checklist (verify before delivering every output)

- [ ] `@` file references included where applicable?
- [ ] OUTCOME is one precise sentence (action + deliverable)?
- [ ] Every constraint is specific — not generic ("preserve TypeScript types", not "don't break things")?
- [ ] VERIFIER is binary and agent-checkable?
- [ ] No step-by-step procedure written (Opus self-generates those)?
- [ ] Out-of-scope boundary explicitly stated?
- [ ] Mode declared and matched to intent type?
- [ ] Correct artifact pipeline will trigger?

---

## Reference Files

| File                               | When to read                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `references/templates.md`          | Every prompt enhancement — intent-specific templates for Opus 4.6 Adaptive Thinking  |
| `references/gemini-md-template.md` | Generating GEMINI.md, .agent/rules/, or AGENTS.md content                            |
| `references/workflows.md`          | Generating Antigravity Workflow files or when a repeating task pattern is identified |
