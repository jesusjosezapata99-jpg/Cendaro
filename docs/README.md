# Cendaro ERP — Documentation Index

> **Source of Truth**: This `/docs` folder contains the canonical specification package for the Cendaro ERP Omnichannel system. All architectural, product, security, and data-modeling decisions reference these documents.

---

## 📋 Product Specifications

| Document                                     | Path                                                                                   |   Status    |
| :------------------------------------------- | :------------------------------------------------------------------------------------- | :---------: |
| **PRD v2.0 — Production & Market Expansion** | [`product/PRD_v2.0_Produccion_y_Mercado.md`](product/PRD_v2.0_Produccion_y_Mercado.md) |  ✅ Active  |
| **PRD v1.0 — Core Omnichannel ERP**          | [`product/PRD_v1.0.md`](product/PRD_v1.0.md)                                           |  ✅ Active  |
| **Legacy PRD v0.7**                          | [`product/LEGACY_PRD_v0.7.md`](product/LEGACY_PRD_v0.7.md)                             | 🗄️ Archived |

### Feature PRDs

| Document               | Path                                                                                                       |  Status   |
| :--------------------- | :--------------------------------------------------------------------------------------------------------- | :-------: |
| **Spreadsheet Import** | [`product/features/FEATURE_PRD_SPREADSHEET_IMPORT.md`](product/features/FEATURE_PRD_SPREADSHEET_IMPORT.md) | ✅ Active |
| **Inventory Import**   | [`product/features/FEATURE_PRD_INVENTORY_IMPORT.md`](product/features/FEATURE_PRD_INVENTORY_IMPORT.md)     | ✅ Active |
| **Catalog Import**     | [`product/features/FEATURE_PRD_CATALOG_IMPORT.md`](product/features/FEATURE_PRD_CATALOG_IMPORT.md)         | ✅ Active |

---

## 🏗 Architecture

| Document                      | Path                                                                                     |  Status   |
| :---------------------------- | :--------------------------------------------------------------------------------------- | :-------: |
| **ERD & Schema Blueprint**    | [`architecture/erd_schema_blueprint_v1.md`](architecture/erd_schema_blueprint_v1.md)     | ✅ Active |
| **Module & API Blueprint**    | [`architecture/module_api_blueprint_v1.md`](architecture/module_api_blueprint_v1.md)     | ✅ Active |
| **Multi-Tenant Architecture** | [`architecture/multi-tenant-architecture.md`](architecture/multi-tenant-architecture.md) | ✅ Active |

---

## 🗄 Data Model

| Document             | Path                                                   |  Status   |
| :------------------- | :----------------------------------------------------- | :-------: |
| **DBML Schema v1**   | [`data/erp_schema_v1.dbml`](data/erp_schema_v1.dbml)   | ✅ Active |
| **Schema Alignment** | [`data/SCHEMA_ALIGNMENT.md`](data/SCHEMA_ALIGNMENT.md) | ✅ Active |

---

## 🔐 Security & Compliance

| Document                                          | Path                                                                                                                       |  Status   |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------- | :-------: |
| **Incident Response Runbook**                     | [`security/INCIDENT_RESPONSE.md`](security/INCIDENT_RESPONSE.md)                                                           | ✅ Active |
| **WAF & Secrets Rotation Runbook**                | [`security/waf-and-secrets-runbook.md`](security/waf-and-secrets-runbook.md)                                               | ✅ Active |
| **01 · Information Security Policy**              | [`compliance/01-INFORMATION-SECURITY-POLICY.md`](compliance/01-INFORMATION-SECURITY-POLICY.md)                             | ✅ Active |
| **02 · Access Control & MFA Policy**              | [`compliance/02-ACCESS-CONTROL-AND-MFA-POLICY.md`](compliance/02-ACCESS-CONTROL-AND-MFA-POLICY.md)                         | ✅ Active |
| **03 · Incident Management & Response**           | [`compliance/03-INCIDENT-MANAGEMENT-AND-RESPONSE.md`](compliance/03-INCIDENT-MANAGEMENT-AND-RESPONSE.md)                   | ✅ Active |
| **04 · Business Continuity & Disaster Recovery**  | [`compliance/04-BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY.md`](compliance/04-BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY.md) | ✅ Active |
| **05 · Data Classification, Retention & Privacy** | [`compliance/05-DATA-CLASSIFICATION-RETENTION-PRIVACY.md`](compliance/05-DATA-CLASSIFICATION-RETENTION-PRIVACY.md)         | ✅ Active |
| **06 · Secure SDLC & Change Management**          | [`compliance/06-SECURE-SDLC-AND-CHANGE-MANAGEMENT.md`](compliance/06-SECURE-SDLC-AND-CHANGE-MANAGEMENT.md)                 | ✅ Active |

---

## 📝 Architecture Decision Records (ADR)

| Decision                                  | Path                                                                           |   Status    |
| :---------------------------------------- | :----------------------------------------------------------------------------- | :---------: |
| **ADR-001** — ERP v1.0 as Source of Truth | [`adr/001-erp-v1-source-of-truth.md`](adr/001-erp-v1-source-of-truth.md)       | ✅ Accepted |
| **ADR-002** — PRD v2.0 Production Roadmap | [`adr/002-prd-v2-production-roadmap.md`](adr/002-prd-v2-production-roadmap.md) | ✅ Accepted |

---

## 🎨 Brand & Showcase Assets

| Asset                         | Dark Mode Path                                                                             | Light Mode Path                                                                              |
| :---------------------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Brand Logo**                | [`assets/cendaro-logo-dark.png`](assets/cendaro-logo-dark.png)                             | [`assets/cendaro-logo-light.png`](assets/cendaro-logo-light.png)                             |
| **Executive Dashboard**       | [`assets/showcase/dashboard-dark.png`](assets/showcase/dashboard-dark.png)                 | [`assets/showcase/dashboard-light.png`](assets/showcase/dashboard-light.png)                 |
| **AI Container Ingestion**    | [`assets/showcase/container-ai-dark.png`](assets/showcase/container-ai-dark.png)           | [`assets/showcase/container-ai-light.png`](assets/showcase/container-ai-light.png)           |
| **Exchange Rates & BCV Desk** | [`assets/showcase/rates-bcv-dark.png`](assets/showcase/rates-bcv-dark.png)                 | [`assets/showcase/rates-bcv-light.png`](assets/showcase/rates-bcv-light.png)                 |
| **Multi-Warehouse Inventory** | [`assets/showcase/inventory-stock-dark.png`](assets/showcase/inventory-stock-dark.png)     | [`assets/showcase/inventory-stock-light.png`](assets/showcase/inventory-stock-light.png)     |
| **Omnichannel Sales Orders**  | [`assets/showcase/orders-sale-dark.png`](assets/showcase/orders-sale-dark.png)             | [`assets/showcase/orders-sale-light.png`](assets/showcase/orders-sale-light.png)             |
| **Accounts Receivable**       | [`assets/showcase/receivables-close-dark.png`](assets/showcase/receivables-close-dark.png) | [`assets/showcase/receivables-close-light.png`](assets/showcase/receivables-close-light.png) |
