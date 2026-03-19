# Antigravity Workflows — Reference Guide

## What Workflows are (vs Rules vs Skills)

|              | Rules                                       | Workflows                                           | Skills                                                     |
| ------------ | ------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| **Trigger**  | Automatic, always active                    | Manual: user types `/workflow-name`                 | Automatic, on description match                            |
| **Use case** | Standing standards, non-negotiable behavior | Repeating task patterns — user decides when to run  | Deep specialized knowledge for specific domains            |
| **Format**   | `GEMINI.md` / `.md` file in `.agent/rules/` | `.md` file in `.agent/workflows/`                   | Directory with `SKILL.md` in `.agent/skills/`              |
| **Best for** | Code style, quality gates, mode defaults    | Test generation, security scan, PR creation, review | Migration protocols, deployment runbooks, audit checklists |

## When to convert a prompt into a Workflow

Recommend creating a Workflow when the user:

- Sends the same type of request repeatedly ("generate tests for this file")
- Has a multi-step process they run at specific project milestones
- Wants a `/command` they can trigger from the agent panel at any time

---

## Workflow File Format

Workflows are plain Markdown files. No YAML frontmatter required.
Antigravity reads the file content as a prompt template when the user types `/[workflow-name]`.

**Storage locations:**

- Global: `~/.gemini/antigravity/global_workflows/[name].md`
- Workspace: `.agent/workflows/[name].md`

> **Note:** The global workflows directory (`~/.gemini/antigravity/global_workflows/`) does not
> exist by default. If you want to install workflows globally (accessible from all workspaces),
> create the directory manually first:
>
> **PowerShell (Windows):**
>
> ```powershell
> New-Item -ItemType Directory -Path "$env:USERPROFILE\.gemini\antigravity\global_workflows" -Force
> ```
>
> **Bash (macOS/Linux):**
>
> ```bash
> mkdir -p ~/.gemini/antigravity/global_workflows
> ```

**Naming convention:** use kebab-case, descriptive, verb-noun format.
Examples: `generate-tests.md`, `security-scan.md`, `create-pr.md`, `code-review.md`

---

## Workflow Templates (Opus 4.6 Adaptive Thinking optimized)

### /generate-tests

**File**: `.agent/workflows/generate-tests.md`
**Usage**: User selects or opens a file, then types `/generate-tests`

```markdown
# Workflow: Generate Tests

@[active-file]

Generate comprehensive tests for the active file.

Coverage targets:

- All exported functions and classes
- Happy path for each function
- Edge cases: empty input, null/undefined, boundary values
- Error paths: invalid input, failed async operations

Test framework: [infer from existing tests in the project — Jest / Vitest / Playwright]
Output: co-located test file following the project's existing naming convention

Constraints:

- Do not modify the implementation file
- Use the same mock patterns found in existing test files
- Tests must be deterministic — mock all I/O, network calls, and timers

Verifier:

- All generated tests pass: `[detected test command]`
- No implementation files modified

[Fast Mode]
```

---

### /security-scan

**File**: `.agent/workflows/security-scan.md`
**Usage**: Run before PR merges or on demand

```markdown
# Workflow: Security Scan

@src/

Perform a security audit of the codebase.

Audit scope:

- Input validation: check all user-controlled inputs for injection vectors
- Authentication: verify auth checks on all protected routes/endpoints
- Secrets: detect any hardcoded credentials, tokens, or API keys
- Dependencies: flag known vulnerable packages (check against npm audit if available)
- Data exposure: identify API responses that may expose sensitive fields

Output format:

- Severity-ranked findings: Critical / High / Medium / Low
- File + line reference for each finding
- One concrete, actionable fix recommendation per finding (reference the actual code)

Constraints:

- Analysis only — do not modify any files
- Base findings on actual code, not assumed behavior

[Fast Mode]
```

---

### /create-pr

**File**: `.agent/workflows/create-pr.md`
**Usage**: After completing a feature or fix, ready to open a PR

```markdown
# Workflow: Create Pull Request

Review all uncommitted or staged changes in the current workspace.

Generate a PR with:

- Title: conventional commits format — `type(scope): description` (e.g., `feat(auth): add OAuth2 login`)
- Body containing:
  - Summary: what changed and why (2-3 sentences)
  - Changes list: bullet points per file with one-line descriptions
  - Testing: how to verify the changes work
  - Screenshots: if UI changed, include a screenshot artifact

Constraints:

- Do not push to main/master directly
- Branch name: follow the pattern `[type]/[short-description]` (e.g., `feat/oauth2-login`)
- Do not include unrelated changes in the same PR

Verifier:

- PR opened successfully with title matching conventional commits format
- All checks pass on the PR

[Planning Mode]
```

---

### /code-review

**File**: `.agent/workflows/code-review.md`
**Usage**: Before merging any significant change

```markdown
# Workflow: Code Review

@[files-changed-in-this-branch]

Perform a thorough code review of the changes.

Review dimensions:

- Correctness: does the code do what the PR description claims?
- Edge cases: are there inputs or states that could cause failures?
- Type safety: any implicit `any`, missing return types, or unsafe casts?
- Performance: obvious algorithmic issues or unnecessary re-renders/re-queries?
- Security: user input validated? no secrets exposed? auth checks present?
- Maintainability: functions too long, unclear names, missing comments on complex logic?

Output format:

- Must-fix issues (block merge): severity Critical or High
- Should-fix issues (non-blocking): severity Medium
- Nits (optional): severity Low

Every issue must include: file + line, explanation, and a concrete suggestion.

[Fast Mode]
```

---

### /refactor-module

**File**: `.agent/workflows/refactor-module.md`
**Usage**: When a specific file or module needs structural cleanup

```markdown
# Workflow: Refactor Module

@[active-file]

Refactor the active file to improve structure without changing behavior.

Apply where relevant:

- Extract functions exceeding 40 lines into named sub-functions
- Remove duplicate logic — extract into shared utilities
- Replace magic numbers/strings with named constants
- Improve variable and function naming for clarity
- Add missing return types on exported functions

Hard constraints:

- Zero behavior change — all public APIs, return types, and side effects identical
- All existing tests pass without modification
- No new files unless extraction genuinely improves structure

Verifier:

- All tests pass unchanged
- `tsc --noEmit` exits 0
- No function exceeds 40 lines

[Planning Mode]
```

---

### /explain-module

**File**: `.agent/workflows/explain-module.md`
**Usage**: When onboarding to unfamiliar code or debugging a complex system

```markdown
# Workflow: Explain Module

@[active-file]

Produce a technical explanation of this module.

Cover:

- Purpose: what problem does this module solve?
- Public API: what does each exported function/class/type do?
- Data flow: how does data enter and exit this module?
- Side effects: what external state does this module read or write?
- Dependencies: what does this module depend on and why?
- Gotchas: non-obvious behavior, edge cases, or common misuse patterns

Format: structured Markdown, usable as inline documentation or a README section.

Constraints:

- Analysis only — do not modify any files
- Reference actual code, not general patterns

[Fast Mode]
```

---

## Creating a Custom Workflow

1. Create the file in `.agent/workflows/[name].md`
2. Write the prompt template using the same rules as enhanced prompts:
   - Outcome first
   - Hard constraints explicit
   - Binary verifier
   - Mode declared
3. Optionally add `@[active-file]` at the top — Antigravity resolves this to the currently
   focused file when the workflow is triggered
4. Trigger in Antigravity by typing `/[name]` in the agent panel

## Workflow Best Practices for Opus 4.6

- **Keep workflow prompts constraint-rich, not step-rich** — Opus self-generates better steps
- **Use `@[active-file]`** so the workflow automatically targets what you're working on
- **Include a verifier** — Opus uses it to self-check completion before marking done
- **Declare mode explicitly** — prevents Opus from defaulting to the wrong mode
- **Version in git** — `.agent/workflows/` should be committed so the whole team has access
