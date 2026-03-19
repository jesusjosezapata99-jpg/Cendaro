---
name: skill-creator
description: >
  Creates, improves, and validates Antigravity Agent Skills end-to-end. ALWAYS
  activate when: the user wants to build a new skill, improve an existing one,
  validate a SKILL.md file, package a skill for distribution, or design the
  directory structure of a skill. Also activate when the user says "make this
   a skill", "turn this workflow into a skill", "package this skill", "help
   me write a SKILL.md", "crear una skill", "mejorar esta skill", "validar
   skill", or "empaquetar skill". When the skill topic requires external
   knowledge (APIs, frameworks, tools, IDE behavior), proactively use the
   browser subagent to research before writing — never guess at technical
   specifics. The output is always a complete, installable skill directory
   ready for Antigravity. Do not use for rules (.agents/rules/) or workflows
   (.agents/workflows/) — those have different structures.
---

# Skill Creator — Antigravity Native

## Claude Opus 4.6 Adaptive Thinking Edition

---

## Antigravity Skill System — Ground Truth

Before creating any skill, this context must be understood:

### How Antigravity loads skills

Antigravity uses **Progressive Disclosure** — only the `name` + `description` fields from
`SKILL.md` frontmatter are always in context (the "menu"). The full `SKILL.md` body and all
supporting files are loaded **only when the agent determines the user's intent matches the skill**.
This means:

- The `description` is the trigger mechanism — it must be semantically precise
- The body can be detailed and long — it only loads when relevant
- Supporting files in `references/`, `scripts/`, `examples/` load on-demand when the skill body instructs the agent to read them

### Skill scopes

| Scope         | Location                                      | When to use                       |
| ------------- | --------------------------------------------- | --------------------------------- |
| **Global**    | `~/.gemini/antigravity/skills/[skill-name]/`  | Personal utilities, cross-project |
| **Workspace** | `[project-root]/.agents/skills/[skill-name]/` | Project-specific skills           |

### SKILL.md structure (official Antigravity format)

```
---
name: skill-name          # Optional — defaults to directory name if omitted
description: "..."        # MANDATORY — the semantic trigger, must be precise
# allowed-tools:          # Claude Code CLI only — Antigravity ignores this field.
#   - Read                # Opus 4.6 in Antigravity has access to all tools by default.
#   - Write
#   - Terminal
---

# Skill Title

## Goal
[What this skill achieves — one precise sentence]

## Instructions
[How the agent should execute — constraints-first, not step-by-step procedures]

## Constraints
[Hard rules the agent must never violate]

## Examples (optional)
[Few-shot input → output pairs — more effective than verbose instructions]
```

### Legal directory contents

```
skill-name/
├── SKILL.md              # Required — definition file
├── scripts/              # Optional — Python or shell scripts the agent executes
├── references/           # Optional — documentation, templates, API specs
├── examples/             # Optional — few-shot input/output pairs
└── assets/               # Optional — static files (templates, icons, config)
```

**Critical**: Skills in Antigravity are **agent-triggered** (semantic match), not user-triggered
like Workflows (`/command`). Never confuse the two.

---

## Skill Creation Process

### Phase 1 — Research (when topic requires external knowledge)

If the skill involves an external tool, API, framework, library, or IDE behavior the agent
does not have verified current knowledge of:

**Use the browser subagent** before writing a single line. Antigravity will open its managed
Chrome browser to navigate to the relevant documentation — this is the intended flow. Research:

- Official documentation (primary source always preferred)
- Exact configuration file paths and formats
- Current version-specific behavior
- Real examples from official codelabs or repos

State to the user: _"I'm going to research [topic] first to make sure the skill is accurate."_
Do not skip this step to save time — an incorrect skill is worse than a slow one.

### Phase 2 — Intent Capture

Extract from the user's request:

```
SKILL PURPOSE    → What specialized capability does this add to the agent?
TRIGGER CONTEXT  → In what situations should the agent load this skill?
INPUT            → What does the agent receive when this skill activates?
OUTPUT           → What must exist when the skill completes?
CONSTRAINTS      → What must the agent never do inside this skill?
SCOPE            → Global (all projects) or Workspace (this project)?
SCRIPTS NEEDED   → Does this skill need to execute code, or is instruction sufficient?
```

If any dimension is unclear, ask the user before proceeding. A wrong assumption wastes both turns.

### Phase 3 — Write the SKILL.md

**Description field (most important):**

- Must be 2-4 sentences, semantically rich
- Include: what the skill does, when to activate it, specific trigger phrases/contexts
- Err toward being "pushy" — skills undertrigger more often than they overtrigger
- Bad: `"Database tools"` → Good: `"Executes read-only SQL queries against the local PostgreSQL instance to debug data states. Use when the user asks to inspect table schemas, query user records, or verify data after migrations."`

**Body — calibrated for Opus 4.6 Adaptive Thinking:**

- Lead with **Goal** (what must be true when done) — not a list of steps
- State **Constraints** explicitly — especially ones in tension with each other
- Surface **constraint tension** deliberately — Opus allocates deeper reasoning when it
  detects requirements that pull against each other (e.g., "description must be semantic-rich
  yet under 4 sentences — wide trigger coverage without false positives")
- Use **Examples** (few-shot) for pattern-heavy tasks — more effective than verbose rules
- Reference supporting files with exact relative paths: `Read references/api-docs.md`
- Never write step-by-step procedures for Opus — it self-decomposes better than any sequence you write
- Keep body under 400 lines; delegate heavy content to `references/` files

**Supporting files:**

- `references/` — static knowledge the body references on-demand
- `examples/` — input/output pairs for few-shot learning
- `scripts/` — Python scripts for actions the agent cannot do as text (file transforms, calculations, external calls)
- `assets/` — templates, config stubs, static files the skill generates or uses

Read `references/skill-patterns.md` for the 6 canonical skill patterns with full examples.

### Phase 4 — Validate

Run validation before presenting the skill to the user.

**One-time setup** — install PyYAML if not already present:

```bash
pip install pyyaml
```

**Run validation** — from inside the `skill-creator/` directory:

```bash
# Windows (PowerShell):
cd [project-root]\.agents\skills\skill-creator
python -m scripts.quick_validate [path-to-new-skill-directory]

# Mac/Linux:
cd [project-root]/.agents/skills/skill-creator
python -m scripts.quick_validate [path-to-new-skill-directory]
```

Fix any validation errors before proceeding.

### Phase 5 — In-Agent Evaluation

Since evaluation runs inside Antigravity (no external CLI available), execute the following
protocol for each test case. Read `references/eval-protocol.md` for the complete procedure.

**Summary:**

1. Define 3-5 test prompts that should trigger the skill
2. For each prompt: mentally simulate what the agent would do with this skill loaded
3. Verify: Does the output match the expected behavior? Does the skill body give enough guidance?
4. Report results in the chat as a structured evaluation table
5. Iterate on the skill body based on findings

### Phase 6 — Package

From inside the `skill-creator/` directory:

```bash
# Windows (PowerShell):
cd [project-root]\.agents\skills\skill-creator
python -m scripts.package_skill [path-to-skill-directory] [output-directory]

# Mac/Linux:
cd [project-root]/.agents/skills/skill-creator
python -m scripts.package_skill [path-to-skill-directory] [output-directory]
```

Present the `.skill` file to the user. Also present the raw directory if they want to inspect it.

**Installation instructions to include:**

```bash
# Global scope (all projects):
# Windows: Copy skill-name/ to %USERPROFILE%\.gemini\antigravity\skills\
# Mac/Linux: Copy skill-name/ to ~/.gemini/antigravity/skills/

# Workspace scope (this project only):
# Copy skill-name/ to [project-root]/.agents/skills/
```

---

## Improving an Existing Skill

When the user provides an existing `SKILL.md` to improve:

1. Read the file completely
2. Evaluate the description: is it precise enough to trigger correctly?
3. Evaluate the body: is it calibrated for Opus 4.6 (goal + constraints) or for an older model (step-by-step procedures)?
4. Identify what's missing from the canonical pattern for its type (read `references/skill-patterns.md`)
5. Rewrite with tracked reasoning — show the user what changed and why

---

## Updating an Existing Installed Skill

When the user wants to update a skill already installed in Antigravity:

- **Preserve the original name** — use the exact same `name` frontmatter and directory name
- **Copy to writable location first** — installed skill paths may be read-only
  ```bash
   # Global: Copy from %USERPROFILE%\.gemini\antigravity\skills\skill-name\ to a temp dir
   # Workspace: Copy from [project-root]\.agents\skills\skill-name\ to a temp dir
  ```
- Edit in the temp location, validate, then copy back
- Package from the temp copy

---

## Communicating with the User

- Match technical depth to the user's familiarity — read their vocabulary before choosing terminology
- Support bilingual communication (Spanish and English) — match the user's language
- Never show internal reasoning about which phase you're in — just execute
- When asking clarifying questions: ask one at a time, not a list
- When presenting the finished skill: show the complete `SKILL.md` inline + offer the packaged `.skill` file

---

## Reference Files

| File                              | When to read                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `references/skill-patterns.md`    | When writing or evaluating any skill — 6 canonical patterns                            |
| `references/eval-protocol.md`     | When running the in-agent evaluation (Phase 5)                                         |
| `references/description-guide.md` | When the description field needs optimization                                          |
| `references/schemas.md`           | When generating evals.json, grading.json, benchmark.json — advanced evaluation schemas |
