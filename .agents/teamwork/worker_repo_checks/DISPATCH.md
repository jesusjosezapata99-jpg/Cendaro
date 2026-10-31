# DISPATCH — worker_repo_checks

## Assignment

Execute the repository verification suite and capture comprehensive diagnostics to support the critical audit of Cendaro ERP.

### Working Directory

`c:\Users\jzs99\Desktop\TEST\.agents\teamwork\worker_repo_checks\`

### Instructions

1. Run repository health and validation commands:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `node scripts/checks/design-guard.mjs --phase F9`
2. Capture full standard output and error output for each command.
3. Analyze any failures, warnings, or gaps found in type-checking, linting, tests, and design-guard rules.
4. Record your findings in `report.md` and deliver `handoff.md` in your working directory.
5. DO NOT modify any application or configuration source files. This is strictly a diagnostic execution run.

## 2026-10-30T23:11:24Z

From: 22137723-b5bb-491b-a106-88e732dbffe5
Priority: MESSAGE_PRIORITY_HIGH

You are the Repo Verification Runner (worker_repo_checks).
Working directory: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\worker_repo_checks\
Original request: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\ORIGINAL_REQUEST.md
Global project scope: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\PROJECT.md
Your dispatch instructions: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\worker_repo_checks\DISPATCH.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL HARD CONSTRAINTS:

1. STRICTLY READ-ONLY DIAGNOSTICS: DO NOT MODIFY ANY SOURCE CODE, APPLICATION FILES, OR CONFIGURATION FILES.
2. Read ORIGINAL_REQUEST.md and DISPATCH.md thoroughly before starting.

TASK:
Run the official Cendaro ERP verification commands and capture comprehensive diagnostic data to incorporate into the audit:

1. Execute the following commands in the workspace root:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `node scripts/checks/design-guard.mjs --phase F9`
2. For each command:
   - Capture execution exit code, duration, standard output, and standard error.
   - If tests or checks fail or pass, document the breakdown (total tests, passed, failed, skipped, error messages).
   - If `pnpm lint` or `pnpm typecheck` report errors, list the exact files, line numbers, and error codes.
   - If `design-guard.mjs` reports violations (e.g. rounded corners, invalid weights, raw colors), categorize them.
3. Output Deliverables:
   - Write a detailed execution report to `c:\Users\jzs99\Desktop\TEST\.agents\teamwork\worker_repo_checks\report.md`.
   - Provide summary, command transcripts, and breakdown in `handoff.md`.
   - Send a completion message back to the orchestrator.
