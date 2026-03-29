---
description: Enterprise Open Source Pre-Flight Audit — Strict validations to execute before pushing any code to the public repository.
---

# 🚀 Enterprise OSS Pre-Flight Audit

This workflow defines the definitive, world-class boundary between internal development and public open-source releases. When executed, the agent MUST relentlessly verify that the repository is 100% compliant with our Enterprise-Grade OSS architecture, ensuring absolutely zero credentials, agent configurations, or IP memory leaks are exposed to the public.

**WARNING: Do not skip any phase. A single credential leak compromises the entire enterprise perimeter and invalidates the Open Source footprint.**

---

## Phase 1: 🛡️ Strict Confidentiality & IP Blinding (Zero-Trust Scan)

**Objective:** Guarantee that internal agent operations, database strings, API keys, private developer configurations, and environment maps never leave the local environment.

// turbo-all

1. **Verify `.gitignore` Ironclad Fencing:**
   - Use `grep_search` on `.gitignore` to ensure the following lines exist explicitly (RegEx exact match):
     - `^\.agents/?$`
     - `^\.gemini/?$`
     - `^\.ops/?$`
     - `^\.env.*$` (must ignore all environments)
   - _Failure Step:_ If any are missing, inject them immediately and abort the flight check until re-verified.

2. **Secrets & Hardcoded Credential Scan (Truffle-Level Regex):**
   - Perform a global scan using `grep_search` across `.ts`, `.tsx`, `.js`, `.json`, and `.md` files (excluding `node_modules` and `.git`):
     - **Groq LPU:** `gsk_[a-zA-Z0-9]{20,}`
     - **Supabase JWT/Service:** `eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*`
     - **DB Strings:** `postgresql://.*:.*@.*:5432/`
     - **Stripe Keys:** `(sk_live_|pk_live_|sk_test_|pk_test_)[a-zA-Z0-9]{20,}`
     - **Internal IPs:** `192\.168\.[0-9]{1,3}\.[0-9]{1,3}` or `10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}`
   - _Failure Step:_ If any matched credentials exist outside of `.env.example`, eradicate them, migrate them to `t3-env`, and abort.

---

## Phase 2: 📊 OSS Telemetry & JSON Integrity

**Objective:** Ensure that automated open-source analyzers (GitHub Advanced Security, Snyk, NPM Auditors, Renovate) can parse our entire monorepo legally and organizationally.

1. **Workspace Matrix Telemetry Check:**
   - Scan **ALL** `package.json` files across the monorepo workspaces (`/apps/*`, `/packages/*`, `/tooling/*`).
   - Validate that each file natively exports:
     - `"license": "AGPL-3.0"`
     - `"author": "Cendaro"`
     - `"repository": { "type": "git", "url": "..." }`
     - `"bugs": { "url": "..." }`
   - _Failure Step:_ Missing telemetry breaks GitHub dependency graphs. Halt the push and automatically patch the `package.json` using Node `fs`.

---

## Phase 3: 🧹 Root Partition Sanitization Guard

**Objective:** Maintain a pristine, corporate-grade root directory. Deprecated, private, or localized design documentation must not pollute the top-level repo or confuse new contributors.

1. **Directory Integrity Check:**
   - Enumerate the repository root (`./`).
   - Identify rogue files matching: `PRD.md`, `ARCHITECTURE_DRAFT.md`, `notas_internas.txt`, `*.sqlite`, `*.log`, `temp/`.
   - _Only the exact following standard markdown files are permitted at the root:_
     - `README.md`
     - `LICENSE`
     - `CONTRIBUTING.md`
     - `SECURITY.md`
     - `CODE_OF_CONDUCT.md`
     - `CHANGELOG.md`
   - _Failure Step:_ If rogue operational files exist at the root, forcibly migrate them to `docs/` or `.gitignore` exceptions.

---

## Phase 4: 🚦 Build, Dependency & Type Matrix

**Objective:** mathematically prove that the structural integrity of the monorepo is unbreakable before deployment. Code that fails tests does not ship.

1. **Lockfile Synchronization:**
   - Run `pnpm install --frozen-lockfile` to explicitly verify that `pnpm-lock.yaml` perfectly matches the `package.json` tree without generating mutations.
2. **Type Synchronization & Strict Mode:**
   - Run `pnpm typecheck` across all packages. An `any` type leak or strict boundary failure triggers `Exit Code 1`.

3. **Linter & Formatting Conformance:**
   - Run `pnpm lint` to assert that zero Sherif dependency defects or ESLint topological faults exist in the workspace.

4. **Unit Test Execution:**
   - Run `pnpm test`. Coverage regressions or failing assertions must fail the check.

5. **Structural Build Matrix (Dry-Run):**
   - Run `pnpm build` or `turbo run build` to assert that Next.js and all `tRPC` packages generate production bundles without hydration or output crashing.

---

## Phase 5: 📜 Final Commit Governance

**Objective:** Assure that the Git commit signature aligns with open source conventional standards.

1. **Staged Changes Validation:**
   - Execute `git diff --cached` and summarize the exact changes that will be pushed. Validate that no `.env` or sensitive `.agents` configurations bypassed the gitignore.
2. **Log Registration:**
   - Append a timestamped entry to `.gemini/knowledge/state.md` verifying the OSS Pre-Flight was executed natively and passed with 0 defects.

---

### Executing Final Clearance

**Upon 100% flawless execution of all 5 phases:**

1. Generate the standard semantic commit message summary for the user.
2. Yield explicitly to the user to authorize the `git push` execution.
