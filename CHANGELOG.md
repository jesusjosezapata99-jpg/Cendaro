# Changelog

All notable changes to Cendaro ERP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive multi-tenancy support across 67 tables implementing RLS and unified `workspaceProcedure` middleware validations.
- 13 advanced architectural domain modules addressing Inventory, Sales, CRM, and Cash Closure operations.
- Smart Spreadsheet Imports leveraging SheetJS for massive Catalog and Inventory processing.
- AI-driven Packing List parsing infrastructure powered by Groq Llama 3 32B.
- Mobile PWA viewport optimizations via `safe-area-insets` and offline manifesting strategies.

### Changed

- Refactored Exchange Rate (`bcv-rate`) synchronization pipeline from legacy client-side fallbacks to robust ISR backend proxy layers.
- Replaced static frontend layout matrices with dynamic, iOS-optimized `oklch` design tokens.

### Security

- Migrated legacy hardcoded environment variables to `t3-env` Zod-verified schema definitions.
- Configured rigorous Content Security Policies (CSP), `X-Content-Type-Options: nosniff`, and `X-Frame-Options` globally across `next.config.js`.
- Sanitized `auth.admin.createUser` error propagation loops to mitigate downstream credential leakages.
