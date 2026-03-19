# Enhancement Templates — Opus 4.6 Adaptive Thinking

## Core principle behind all templates

These templates are built around how Opus 4.6 Adaptive Thinking processes tasks:

- **Goal + constraints → Opus self-decomposes** into steps (always better than human-written steps)
- **Tension between requirements** → triggers deeper thinking budget
- **Binary verifiers** → Opus uses these to self-check before marking done
- **`@` context injection** → ground truth, not description — always leads the prompt

Never add procedural steps. That is Opus's job. Your job is to define what "done" looks like
and what cannot change getting there.

---

## Template: BUILD — Implement new feature or component

```
@[target-file] @[related-types-file] @[related-tests-file]

Implement [specific feature name] in [target module].

Outcome: [One precise sentence — what must exist and work when done]

Constraints:
- Preserve [existing API signature / TypeScript strict types / passing test suite]
- Do not modify [explicitly out-of-scope file or module]
- Do not introduce new dependencies — use [existing utility/library] if needed
- Follow the [pattern/convention] established in [reference file]

Out of scope: [explicit boundary — what Opus must NOT touch]

Verifier:
- [Binary check 1 — e.g., "Function returns X given input Y"]
- [Binary check 2 — e.g., "All tests in [file] pass without modification"]
- [Binary check 3 — e.g., "No TypeScript errors, tsc --noEmit exits 0"]

[Planning Mode]
```

**Why this works for Opus 4.6:** The outcome + constraints create the tension that triggers
adaptive thinking. Opus will generate a decomposition superior to any step-by-step you could write.
The `@` injections give it ground truth to reason against.

---

## Template: FIX — Debug and repair broken behavior

```
@[broken-file] @[related-test-file] @[error-output-or-log-if-available]

Diagnose and fix the [specific symptom] in [file/function].

Observed: [What is happening — be precise, include error message if known]
Expected: [What must happen instead]
Reproduction: [How to trigger the issue — optional but valuable if known]

Constraints:
- Do not refactor code unrelated to the root cause
- Preserve all existing function signatures and return types
- All currently passing tests must remain passing

Out of scope: [other bugs, performance, unrelated code]

Verifier:
- [Symptom no longer occurs under stated condition]
- [Test suite exits 0 after the fix]
- [No new TypeScript/linting errors introduced]

[Fast Mode — if clearly isolated to one cause in 1-2 files]
[Planning Mode — if root cause is systemic or spans multiple modules]
```

**Why this works for Opus 4.6:** Telling Opus what to observe vs. expect triggers its diagnostic
reasoning. Do NOT pre-diagnose the cause — Opus will surface a more accurate root cause analysis
using its adaptive thinking budget.

---

## Template: REFACTOR — Restructure without changing behavior

```
@[target-file] @[dependent-files-or-tests]

Refactor [file/function/module] to achieve [specific structural goal].

Outcome: [What the code structure must look like when done — e.g., "business logic extracted
into [ServiceName], UI component only handles rendering and event delegation"]

What changes are allowed:
- [Specific structural change 1 — e.g., "extract [X] into a separate file"]
- [Specific structural change 2]

Hard constraints:
- Zero behavior change — all public APIs, return types, and side effects identical
- All existing tests pass without modification to the test files
- No additional files beyond [explicitly scoped new files] created
- No changes to [adjacent files] unless strictly required by import updates

Out of scope: [performance, feature additions, styling, unrelated modules]

Verifier:
- All tests pass unchanged: `[test command]`
- Public API surface matches before/after: [specific function signatures preserved]
- [Measurable structural improvement — e.g., "no file exceeds 150 lines", "no cross-domain imports"]

[Planning Mode]
```

**Why this works for Opus 4.6:** The tension between "zero behavior change" and "structural
transformation" is exactly the kind of constraint problem that maximally engages adaptive thinking.

---

## Template: TEST — Generate or improve test coverage

```
@[file-under-test] @[existing-test-file-if-any]

Generate [unit / integration / e2e] tests for [function/module/component].

Coverage targets:
- Happy path: [specific valid input → expected output]
- Edge case: [boundary condition or empty/null input]
- Error path: [invalid input or failure condition → expected error behavior]
- [Additional scenario if known]

Test framework: [infer from existing tests — Jest / Vitest / Playwright / etc.]
Output location: [follow existing convention, e.g., `[file].test.ts` co-located]

Constraints:
- Do not modify the implementation under test
- Use the same mock/stub patterns found in [existing test reference]
- Tests must be deterministic — mock all I/O, timers, and external calls
- No test helper libraries not already in the project

Verifier:
- All generated tests pass on first run: `[test command]`
- Coverage for [file] includes all listed scenarios
- No implementation files modified

[Fast Mode]
```

---

## Template: MIGRATE — Upgrade, update, or move code

```
@[affected-files-glob] @[package.json-or-config]

Migrate [specific thing] from [current state] to [target state].

Migration scope:
- Files: [specific paths or glob — e.g., `src/hooks/**/*.ts`]
- Change: [precise description — e.g., "Replace react-query v3 useQuery API with v5 API"]

Hard constraints:
- Behavior must be identical before and after — no feature changes
- Do not upgrade dependencies other than [the migration target]
- Preserve all existing query keys, cache behavior, and error handling
- Update test files only where the new API requires it

Out of scope: [other dependencies, unrelated modules, performance optimization]

Verifier:
- Application starts without errors: `[start command]`
- All tests pass: `[test command]`
- No remaining usage of deprecated [old API]: `grep -r "[deprecated pattern]" src/`
- [Additional migration-specific check]

[Planning Mode — always for migrations]
```

**Why this works for Opus 4.6:** Migrations are exactly the scenario where Opus's ability to
sustain reasoning across large codebases and maintain state over many tool calls shines most.
Give it the migration target and the invariants — it plans the execution sequence better than any
step-by-step you could write.

---

## Template: ANALYZE — Explain, audit, or review code

```
@[target-file-or-module]

Analyze [file/system/function] and produce [specific analysis type].

Focus:
- [Concern 1 — e.g., "Identify potential memory leaks in the event listener setup"]
- [Concern 2 — e.g., "Flag input validation gaps that could allow injection"]
- [Concern 3 — e.g., "Assess coupling between [ModuleA] and [ModuleB]"]

Output format:
- Severity-ranked findings: Critical / Medium / Low
- Specific line or function reference for each finding
- One concrete, actionable recommendation per finding
- No generic advice — every recommendation must reference the actual code

Constraints:
- Analysis only — do not modify any files
- Base findings on actual code, not assumed behavior

[Fast Mode]
```

---

## Template: DEVOPS — Infrastructure, pipelines, and automation

```
@[existing-config-files-if-any]

Set up [pipeline / container / environment / automation] for [specific purpose].

Target: [dev / staging / production / CI] on [platform: GitHub Actions / Cloud Run / Docker / etc.]

Requirements:
- [Requirement 1 — specific, measurable]
- [Requirement 2]
- [Requirement 3]

Hard constraints:
- No secrets or credentials in any file — use environment variables throughout
- Must work on [platform/OS constraint if applicable]
- [Existing pipeline/config must not be modified unless explicitly in scope]
- [Compliance or security constraint if applicable]

Out of scope: [monitoring, alerting, unrelated infrastructure]

Verifier:
- [Specific verifiable outcome — e.g., "docker compose up starts all services, health check returns 200"]
- [Second check — e.g., "CI pipeline runs on PR open and completes in under 5 minutes"]

[Planning Mode — always for DevOps]
```

---

## Template: MULTI — Multiple intents in one request

When the user's request contains two or more intent types (e.g., "fix the bug, add tests, and update the docs"):

```
@[all-relevant-files]

Execute the following tasks. Complete each task fully before starting the next.

── Task 1 — [TYPE] ──────────────────────
[Insert the relevant single-task template above, filled in]

── Task 2 — [TYPE] ──────────────────────
[Insert the relevant single-task template above, filled in]

── Task 3 — [TYPE] — if applicable ──────
[...]

Global constraints (apply across all tasks):
- [Shared constraint 1]
- [Shared constraint 2]

Global verifier:
- All tasks completed with no regressions introduced
- Final state: `[test command]` exits 0

[Planning Mode — always for multi-task]
```

---

## Anti-patterns — Never produce these

| ❌ Never                        | ✅ Instead                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| "Make the code better"          | "Refactor `UserProfile.tsx` to extract data-fetching into `useUserProfile.ts` hook"                                                        |
| "Fix all the bugs"              | "Fix the null reference in `cart.service.ts:47` when `user.preferences` is undefined"                                                      |
| "Add some tests"                | "Add unit tests for `validateEmail()` in `validators.ts` covering valid, invalid, empty"                                                   |
| "Please try to implement login" | "Implement email/password auth in `src/auth/` using NextAuth.js — JWT session, redirect to `/dashboard` on success"                        |
| "Update to latest"              | "Migrate `react-query` from v3 to v5 in `src/hooks/` — update `useQuery` calls to new API, preserve all query keys"                        |
| "Refactor everything"           | "Extract HTTP concerns from `OrderController.ts` into `OrderService.ts` — zero behavior change"                                            |
| "Make it faster"                | "Profile `src/api/search.ts`, identify the bottleneck in the query builder, and optimize it — response time < 200ms on 10k records"        |
| "Add error handling"            | "Add typed error handling in `fetchUser()` — catch `NetworkError` and `AuthError` separately, surface user-facing messages via `useToast`" |

---

## @ Context Injection Patterns

### When to inject what

| Situation          | What to inject                                                |
| ------------------ | ------------------------------------------------------------- |
| Fixing a bug       | `@broken-file @test-file @error-log`                          |
| Building a feature | `@target-module @types-file @similar-component-for-reference` |
| Refactoring        | `@target-file @all-files-that-import-it`                      |
| Adding tests       | `@implementation-file @existing-test-for-pattern-reference`   |
| Migrating an API   | `@package.json @all-files-using-old-api`                      |
| DevOps setup       | `@existing-config @dockerfile-if-any`                         |

### @ injection syntax in Antigravity

```
@filename.ts                    → single file
@src/components/               → entire directory
@src/**/*.test.ts              → glob pattern
@github (MCP)                  → GitHub issues/PRs context
@jira (MCP)                    → Jira ticket context
```
