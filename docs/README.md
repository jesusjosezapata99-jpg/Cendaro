# Cendaro ERP — Documentation Index

> **Source of Truth**: This `/docs` folder contains the canonical specification package for the Cendaro ERP Omnicanal system. All architectural, product, and data-modeling decisions reference these documents.

---

## 📋 Product Specifications

| Document            | Path                                                       |   Status    |
| ------------------- | ---------------------------------------------------------- | :---------: |
| **PRD v1.0**        | [`product/PRD_v1.0.md`](product/PRD_v1.0.md)               |  ✅ Active  |
| **Legacy PRD v0.7** | [`product/LEGACY_PRD_v0.7.md`](product/LEGACY_PRD_v0.7.md) | 🗄️ Archived |

### Feature PRDs

| Document               | Path                                                                                                       |  Status   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | :-------: |
| **Spreadsheet Import** | [`product/features/FEATURE_PRD_SPREADSHEET_IMPORT.md`](product/features/FEATURE_PRD_SPREADSHEET_IMPORT.md) | ✅ Active |
| **Inventory Import**   | [`product/features/FEATURE_PRD_INVENTORY_IMPORT.md`](product/features/FEATURE_PRD_INVENTORY_IMPORT.md)     | ✅ Active |
| **Catalog Import**     | [`product/features/FEATURE_PRD_CATALOG_IMPORT.md`](product/features/FEATURE_PRD_CATALOG_IMPORT.md)         | ✅ Active |

---

## 🏗 Architecture

| Document                      | Path                                                                                     |  Status   |
| ----------------------------- | ---------------------------------------------------------------------------------------- | :-------: |
| **ERD & Schema Blueprint**    | [`architecture/erd_schema_blueprint_v1.md`](architecture/erd_schema_blueprint_v1.md)     | ✅ Active |
| **Module & API Blueprint**    | [`architecture/module_api_blueprint_v1.md`](architecture/module_api_blueprint_v1.md)     | ✅ Active |
| **Multi-Tenant Architecture** | [`architecture/multi-tenant-architecture.md`](architecture/multi-tenant-architecture.md) | ✅ Active |

---

## 🗄 Data Model

| Document             | Path                                                   |  Status   |
| -------------------- | ------------------------------------------------------ | :-------: |
| **DBML Schema v1**   | [`data/erp_schema_v1.dbml`](data/erp_schema_v1.dbml)   | ✅ Active |
| **Schema Alignment** | [`data/SCHEMA_ALIGNMENT.md`](data/SCHEMA_ALIGNMENT.md) | ✅ Active |

---

## 🔐 Security

| Document                      | Path                                                             |  Status   |
| ----------------------------- | ---------------------------------------------------------------- | :-------: |
| **Incident Response Runbook** | [`security/INCIDENT_RESPONSE.md`](security/INCIDENT_RESPONSE.md) | ✅ Active |

---

## 📝 Architecture Decision Records (ADR)

| Decision                                  | Path                                                                     |   Status    |
| ----------------------------------------- | ------------------------------------------------------------------------ | :---------: |
| **ADR-001** — ERP v1.0 as Source of Truth | [`adr/001-erp-v1-source-of-truth.md`](adr/001-erp-v1-source-of-truth.md) | ✅ Accepted |

---

## 🎨 Assets

| Asset             | Path                                                             |
| ----------------- | ---------------------------------------------------------------- |
| Logo (Dark Mode)  | [`assets/cendaro-logo-dark.png`](assets/cendaro-logo-dark.png)   |
| Logo (Light Mode) | [`assets/cendaro-logo-light.png`](assets/cendaro-logo-light.png) |

---

## Source-of-Truth Priority

1. PRD v1.0
2. ERD & Schema Blueprint v1
3. DBML Schema v1
4. Module/API Blueprint v1
5. Existing repo structure and tooling
6. Legacy PRD v0.7 (historical reference only)

## Architecture Overview

- **Style**: Modular monolith
- **Frontend**: Next.js 16 App Router (Turborepo)
- **Backend boundary**: Server actions + tRPC
- **Database**: PostgreSQL + Drizzle ORM
- **UI**: shadcn/ui + Tailwind CSS v4
- **Monorepo**: Turborepo + pnpm workspaces
