# Skill Patterns — Canonical Reference

Six patterns cover ~95% of all skills built in Antigravity. Every skill maps to one primary pattern.
Use these as templates — fill in the specifics, don't copy them verbatim.

---

## Pattern 1 — Pure Instruction Router

**When to use**: The skill is entirely prompt-engineering. No scripts, no external files needed.
The agent's language understanding is sufficient to execute the task.

**Examples**: Commit formatter, code reviewer, naming convention enforcer, PR description writer.

```
skill-name/
└── SKILL.md
```

**SKILL.md body structure:**

```markdown
---
name: git-commit-formatter
description:
  Formats git commit messages to the Conventional Commits specification.
  Activate when the user asks to commit changes, write a commit message, or stage files for commit.
---

# Git Commit Formatter

## Goal

Every commit message produced follows the Conventional Commits spec exactly.

## Format

`<type>[optional scope]: <description>`

Allowed types: feat · fix · docs · style · refactor · perf · test · chore · ci · build

## Constraints

- Description must be imperative mood ("add feature" not "added feature")
- Description must be under 72 characters
- Breaking changes require a `BREAKING CHANGE:` footer
- Never invent a type not in the allowed list

## Examples

User says: "commit the auth changes"
Output: `feat(auth): implement JWT refresh token rotation`

User says: "commit the README update"
Output: `docs: update installation instructions for Windows`
```

**Key insight**: For Opus 4.6, constraints + examples outperform verbose step lists every time.

---

## Pattern 2 — Reference Loader

**When to use**: The skill needs static knowledge that would be wasteful to embed in the body
(license headers, API specs, template files, legal text, large configs). The body instructs
the agent to read specific files from `references/` when needed.

**Examples**: License header adder, API client generator, config file scaffolder, template applier.

```
skill-name/
├── SKILL.md
└── references/
    └── [template-or-spec-file]
```

**SKILL.md body key section:**

```markdown
## Instructions

1. Read the template at `references/LICENSE_HEADER.txt` — read it verbatim, do not paraphrase
2. Prepend the template content to the target file
3. Adapt comment syntax to the file's language:
   - TypeScript/JavaScript/Java/C++: keep `/* ... */` block as-is
   - Python/Shell/YAML: convert to `#` line comments
   - HTML/XML: use `<!-- ... -->`

## Constraints

- Never modify the template content — legal text must be exact
- Never add the header to files that already have one (check first 5 lines)
```

---

## Pattern 3 — Few-Shot Transformer

**When to use**: The task involves a consistent transformation where showing the pattern (input →
output pair) is more reliable than explaining the rules in English. LLMs are pattern-matching
engines — one good example beats 20 rules.

**Examples**: JSON→TypeScript types, API response→Zod schema, SQL→Drizzle schema, log→structured report.

```
skill-name/
├── SKILL.md
└── examples/
    ├── input.[ext]    ← the "before" state
    └── output.[ext]   ← the "after" state
```

**SKILL.md body key section:**

```markdown
## Goal

Transform the user's input into the target format, matching the style in `examples/output.ts` exactly.

## Instructions

1. Read `examples/input.json` to understand the input format
2. Read `examples/output.ts` to understand the expected output style
3. Apply the same transformation to the user's input

## Style rules (extracted from the example)

- Use PascalCase for type/interface names
- All optional fields use `?:` not `| undefined`
- Nested objects become separate named interfaces

## Constraints

- Never add fields not present in the input
- Never use `any` type
```

---

## Pattern 4 — Script Executor

**When to use**: The task requires deterministic computation, file system operations, or binary
execution that the LLM cannot reliably do as text (math, file transforms, linting, packaging).

**Examples**: Skill packager, test runner, file format converter, dependency analyzer.

```
skill-name/
├── SKILL.md
└── scripts/
    ├── __init__.py
    └── run.py
```

**SKILL.md body key section:**

````markdown
## Goal

[What the script produces]

## Execution

Run the script from the terminal in the skill's parent directory:

```bash
python scripts/run.py [arguments]
```
````

## Arguments

- `[arg1]`: [description]
- `[arg2]`: [description]

## Output

[What the script produces and where to find it]

## Constraints

- Always verify the script exits 0 before presenting results to the user
- If the script fails, read the error output and diagnose before retrying

```

**Key**: The skill body tells the agent how to call the script and what to do with its output.
The script itself handles the deterministic work.

---

## Pattern 5 — Research-First Builder

**When to use**: The skill needs to produce accurate output about external systems (APIs, frameworks,
tools, cloud services) where accuracy depends on current documentation, not training data.

**Examples**: MCP server integrator, framework-specific component generator, cloud resource configurator.

```

skill-name/
├── SKILL.md
└── references/
└── [researched-spec.md] ← populated by the agent during first run

````

**SKILL.md body key section:**

```markdown
## Pre-Execution Research Protocol

Before generating any output, use the browser subagent to verify current documentation:

1. Navigate to [official docs URL]
2. Read [specific section relevant to the task]
3. Extract: [exact config format / API signature / required fields]

State to the user: "Researching [topic] to ensure accuracy..."

Do not proceed until research is complete. Outdated information produces broken output.

## Instructions
[Generate output based on verified research, not assumed knowledge]
````

---

## Pattern 6 — Composite Orchestrator

**When to use**: The skill coordinates multiple sub-tasks, each of which could be a separate skill.
Use this when the user's goal requires a sequence of different capabilities working together.

**Examples**: Full feature scaffolder, deploy pipeline creator, multi-file refactor orchestrator.

```
skill-name/
├── SKILL.md
├── references/
│   ├── [sub-task-1-spec.md]
│   └── [sub-task-2-spec.md]
└── scripts/
    └── [orchestration-script.py]
```

**SKILL.md body key section:**

```markdown
## Goal

[The complete end state after all sub-tasks complete]

## Task Sequence

### Task 1 — [Name]

[Constraints and outcome for this sub-task]

### Task 2 — [Name]

[Constraints and outcome — reference Task 1 output if needed]

### Task 3 — [Name]

[...]

## Global Constraints (apply across all tasks)

- Complete each task fully before starting the next
- If any task fails validation, stop and report — do not proceed to the next task
- [Other cross-cutting constraints]

## Verification

[How to confirm the entire sequence succeeded]
```

---

## Pattern Selection Guide

| User says                                | Pattern                    |
| ---------------------------------------- | -------------------------- |
| "enforce X standard / style"             | 1 — Pure Instruction       |
| "add X to every file / always include X" | 2 — Reference Loader       |
| "convert X format to Y format"           | 3 — Few-Shot Transformer   |
| "run X / package X / calculate X"        | 4 — Script Executor        |
| "generate X for [external tool/API]"     | 5 — Research-First         |
| "build the whole X feature / scaffold X" | 6 — Composite Orchestrator |

---

## Description Field — Quality Checklist

Before finalizing any skill's `description`, verify:

- [ ] Does it say **what** the skill does in the first sentence?
- [ ] Does it say **when** to activate it (specific contexts, not just "when relevant")?
- [ ] Does it include specific trigger phrases the user might actually say?
- [ ] Is it free of vague words: "helps", "assists", "various", "general"?
- [ ] Would a different skill accidentally match the same description? (if yes → tighten it)
- [ ] Is it "pushy" enough? Skills undertrigger — lean toward explicit activation conditions
