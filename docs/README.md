# Cendaro ERP — Documentation Index

> **Source of Truth**: This `/docs` folder contains the canonical specification package for the Cendaro ERP Omnicanal system. All architectural, product, and data-modeling decisions reference these documents.

## Document Map

| Document                   | Path                                                                                      | Status                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **PRD v1.0**               | [`docs/product/PRD_v1.0.md`](product/PRD_v1.0.md)                                         | ✅ Active — canonical product specification            |
| **Legacy PRD v0.7**        | [`docs/product/LEGACY_PRD_v0.7.md`](product/LEGACY_PRD_v0.7.md)                           | 🗄️ Archived — historical reference only                |
| **ERD & Schema Blueprint** | [`docs/architecture/erd_schema_blueprint_v1.md`](architecture/erd_schema_blueprint_v1.md) | ✅ Active — data model & entity relationships          |
| **Module & API Blueprint** | [`docs/architecture/module_api_blueprint_v1.md`](architecture/module_api_blueprint_v1.md) | ✅ Active — module boundaries, API surface, navigation |
| **DBML Schema**            | [`docs/data/erp_schema_v1.dbml`](data/erp_schema_v1.dbml)                                 | ✅ Active — machine-readable schema definition         |
| **Schema Alignment**       | [`docs/data/SCHEMA_ALIGNMENT.md`](data/SCHEMA_ALIGNMENT.md)                               | ✅ Active — maps existing Drizzle schema to new ERD    |
| **ADR-001**                | [`docs/adr/001-erp-v1-source-of-truth.md`](adr/001-erp-v1-source-of-truth.md)             | ✅ Active — decision record for v1.0 adoption          |

## Source-of-Truth Priority

1. PRD v1.0
2. ERD & Schema Blueprint v1
3. DBML Schema v1
4. Module/API Blueprint v1
5. Existing repo structure and tooling
6. Legacy PRD v0.7 (historical reference only)

## Architecture Overview

- **Style**: Modular monolith
- **Frontend**: Next.js App Router (Turborepo)
- **Backend boundary**: Server actions + tRPC
- **Database**: PostgreSQL + Drizzle ORM
- **UI**: shadcn/ui + Tailwind CSS
- **Monorepo**: Turborepo + pnpm workspaces
