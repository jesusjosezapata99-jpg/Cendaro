# Description Field Optimization Guide

The `description` frontmatter field is the **only** mechanism Antigravity uses to decide
whether to load a skill. Every other quality attribute is irrelevant if the skill never triggers.

---

## How Antigravity Matches Skills

Antigravity performs **semantic matching** between the user's prompt and each skill's `description`.
It is not keyword matching — "commit my changes" can match a description that says "formats git
commit messages" because the semantic intent overlaps.

This means:

- Vague descriptions fail because the model can't distinguish them from other skills
- Over-specific descriptions fail because they miss paraphrased variations
- The optimal description is semantically rich but not exhaustive

---

## The 4 Components of a Strong Description

### Component 1 — Action Verb + Domain (what)

State exactly what the skill does. Start with a verb.

❌ `"Database tools"`  
✅ `"Executes read-only SQL queries against the local PostgreSQL database"`

### Component 2 — Trigger Context (when)

State the specific situations that should activate this skill.

❌ `"Use when relevant"`  
✅ `"Use when the user asks to inspect table schemas, query user records, or verify data after migrations"`

### Component 3 — Explicit Trigger Phrases (recognition)

Include 2-3 phrases the user might actually say.

❌ (none)  
✅ `"Activate when the user says 'query the database', 'check the schema', or 'look up user data'"`

### Component 4 — Boundary Statement (disambiguation)

When multiple skills cover adjacent topics, add a "not for X" clause.

❌ (none when there's ambiguity)  
✅ `"Do not use for write operations — read-only only. For migrations, use the db-migrator skill."`

---

## Description Templates by Pattern

### Pattern 1 — Pure Instruction Router

```
[Verb phrase — what it enforces/formats/generates]. Use when the user asks to
[trigger action 1], [trigger action 2], or [trigger action 3]. Also activate when
the user mentions [keyword 1] or [keyword 2].
```

### Pattern 2 — Reference Loader

```
Adds/applies [specific thing] to [specific target]. Always activate when the user
creates a new [file type], asks to [trigger action], or mentions [specific artifact].
The [thing] is loaded from a template — do not generate it from memory.
```

### Pattern 3 — Few-Shot Transformer

```
Converts [input format] into [output format] following [specific style/standard].
Use when the user provides [input type] and wants [output type], or says
"convert [X] to [Y]". Applies the transformation pattern from included examples exactly.
```

### Pattern 4 — Script Executor

```
Runs [script name] to [specific action]. Use when the user asks to [trigger action 1]
or [trigger action 2]. Executes Python scripts in the skill's scripts/ directory —
does not generate code manually for this task.
```

### Pattern 5 — Research-First Builder

```
Generates [specific output] for [specific tool/framework/API] by first reading current
official documentation. Always activate when the user asks to [trigger action] with/for
[tool name]. Never relies on training data for [tool name] specifics — researches first.
```

### Pattern 6 — Composite Orchestrator

```
Orchestrates the full [workflow name] from [start state] to [end state]. Use when
the user wants to [complete complex goal] in one operation. Covers: [sub-task 1],
[sub-task 2], [sub-task 3]. Activate even for partial requests within this workflow.
```

---

## Common Failure Modes and Fixes

| Symptom                           | Diagnosis                               | Fix                                            |
| --------------------------------- | --------------------------------------- | ---------------------------------------------- |
| Skill never triggers              | Description too narrow or too technical | Add paraphrase variants of the trigger         |
| Skill triggers too often          | Description too broad                   | Add "do not use for X" clause                  |
| Skill triggers for wrong skill    | Collision with another skill            | Add distinguishing boundary statement          |
| Skill triggers inconsistently     | Description uses unusual vocabulary     | Replace with vocabulary the user actually uses |
| User has to ask for it explicitly | Activation conditions too passive       | Add "Always activate when..." phrasing         |

---

## Before / After Examples

### ❌ Weak description

```
description: "Helps with database queries and schema inspection."
```

Problems: vague verb, no trigger context, no specific phrases, will collide with any DB skill.

### ✅ Strong description

```
description: >
  Executes read-only SQL queries against the local PostgreSQL instance to inspect
  data states and table schemas. Use when the user asks to "check the database",
  "query user records", "inspect a table", or "verify data after a migration".
  Read-only only — for schema changes or migrations, use the db-migrator skill.
```

---

### ❌ Weak description

```
description: "Creates skills for Antigravity."
```

Problems: one sentence, no trigger phrases, no context, won't distinguish from general help.

### ✅ Strong description

```
description: >
  Creates, improves, validates, and packages Antigravity Agent Skills end-to-end.
  ALWAYS activate when: the user wants to build a new skill, improve an existing SKILL.md,
  package a skill for distribution, or says "make this a skill", "turn this into a skill",
  or "write a SKILL.md". Researches unfamiliar topics with the browser subagent before writing.
  Output is always a complete, installable skill directory.
```

---

## The "Pushiness" Principle

Antigravity skills **undertrigger by default** — the model is conservative about loading extra
context unless it's clearly justified. Counter this by:

- Starting trigger conditions with `ALWAYS activate when` for non-negotiable cases
- Listing multiple phrasings the user might use (not just the canonical one)
- Using `even if they don't explicitly ask for a skill` for skills that should run proactively
- Using `Never skip this skill when X is in context` for critical workflow skills
