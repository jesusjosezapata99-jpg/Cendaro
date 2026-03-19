---
trigger: always_on
---

# Prompt Enhancement Protocol

## Task Intake

Before acting on any user request, internally evaluate:

- INTENT: BUILD / FIX / REFACTOR / TEST / MIGRATE / ANALYZE / DEVOPS / MULTI
- TARGET: Specific files in scope (prefer @-referenced files for ground truth)
- OUTCOME: What must be true when done — one sentence, action + deliverable
- CONSTRAINTS: What must not change, break, or be introduced — enumerate specifically
- VERIFIER: Binary check the agent can run to confirm completion

Use the evaluation result to shape execution. Do not narrate it.

## Adaptive Thinking Engagement

State hard constraints explicitly — especially ones in tension with each other.
This triggers deeper reasoning in models with adaptive thinking (Opus 4.6, o-series).

Do not pre-sequence steps. Generate the execution plan internally from outcome + constraints.

### Core Rule for Opus 4.6

> Give the model the destination and the guardrails. Never give it the route.

| ❌ Counterproductive           | ✅ Effective                                           |
| ------------------------------ | ------------------------------------------------------ |
| Step-by-step instructions      | Goal + hard constraints — model self-decomposes        |
| "First do X, then Y, then Z"   | "The outcome must satisfy A and B. Constraints: C, D." |
| Vague success ("make it work") | Binary verifier (agent can check programmatically)     |

Constraint tension triggers deeper reasoning. Ambiguous scope forces the model to reason about
what's in vs out before acting. Always surface these tensions explicitly.

## Mode Rules

Planning: task spans 3+ files, architectural, irreversible, browser-verifiable, or downstream deps
Fast: isolated to 1-2 files, clearly bounded, easily reversible
When uncertain: default to Planning Mode.

## Non-Negotiables

- Lead with @-injected context over described context whenever possible
- Every constraint must be specific — not "don't break things" but "preserve strict types in src/auth/"
- Every verifier must be binary — not "make sure it works" but "pnpm test exits 0"
- Run tests after every change and report failures before proceeding
- Never modify files outside the stated scope without flagging it first
- Show a diff summary before applying changes to existing files
- Walkthrough must include a runnable verification command

## Skill Bridge

For intent-specific output templates (BUILD, FIX, REFACTOR, TEST, MIGRATE, ANALYZE, DEVOPS),
anti-pattern tables, quality checklists, and @ context injection patterns, reference the full skill:
`.agents/skills/prompt-enhancer-antigravity/SKILL.md`
