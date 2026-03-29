# Changelog

All notable changes to Cendaro ERP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-03-29

### Added

- Comprehensive multi-tenancy support across 67 tables implementing RLS and unified `workspaceProcedure` middleware validations.
- 13 advanced architectural domain modules addressing Inventory, Sales, CRM, and Cash Closure operations.
- Smart Spreadsheet Imports leveraging SheetJS for massive Catalog and Inventory processing.
- AI-driven Packing List parsing infrastructure powered by Groq Qwen3-32B with Llama 4 Scout fallback.
- Mobile PWA viewport optimizations via `safe-area-insets` and offline manifesting strategies.
- 7-layer security architecture: Authentication → Authorization → Data Isolation → Audit Trail → Rate Limiting → Transport Security → Session Hardening.
- Dual-vector rate limiting (IP + Username) with hard lockout after 8 failures.
- MFA/TOTP mandatory for owner and admin roles with AAL2 enforcement.
- GitHub Actions CI/CD pipeline: install → audit → typecheck → lint → build → test.
- `.github/CODEOWNERS` enforcing mandatory owner approval on all PRs.
- Branch protection rules for `main` and wildcard `*` (all branches).
- Community infrastructure: CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, issue templates, PR template.
- Dependabot automated dependency security updates (weekly).

### Changed

- Refactored Exchange Rate (`bcv-rate`) synchronization pipeline from legacy client-side fallbacks to robust ISR backend proxy layers.
- Replaced static frontend layout matrices with dynamic, iOS-optimized `oklch` design tokens.

### Security

- Migrated legacy hardcoded environment variables to `t3-env` Zod-verified schema definitions.
- Configured rigorous Content Security Policies (CSP), `X-Content-Type-Options: nosniff`, and `X-Frame-Options` globally across `next.config.js`.
- Sanitized `auth.admin.createUser` error propagation loops to mitigate downstream credential leakages.
- Escaped LIKE wildcard characters (`%`, `_`, `\`) in all search endpoints to prevent LIKE injection.
- Sanitized API error responses to prevent internal stack trace exposure to clients.
- Implemented `.env.example` with mandatory secret rotation checklist before public release.
