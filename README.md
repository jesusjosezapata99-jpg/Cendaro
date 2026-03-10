<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/%E2%96%B2_CENDARO-ERP_PLATFORM-2463eb?style=for-the-badge&labelColor=0a0a0a" />
    <img src="https://img.shields.io/badge/%E2%96%B2_CENDARO-ERP_PLATFORM-2463eb?style=for-the-badge&labelColor=111" alt="Cendaro ERP" />
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1-000?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.1-087ea4?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tRPC-11.12-398CCB?style=flat-square&logo=trpc&logoColor=white" alt="tRPC" />
  <img src="https://img.shields.io/badge/Drizzle-0.45-C5F74F?style=flat-square&logo=drizzle&logoColor=black" alt="Drizzle" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-4.2-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Turborepo-2.8-EF4444?style=flat-square&logo=turborepo&logoColor=white" alt="Turborepo" />
</p>

<p align="center">
  <strong>Enterprise-grade omnichannel ERP</strong> for wholesale + retail commerce in Venezuela.<br/>
  Unified inventory · Multi-currency pricing engine · AI-powered container processing · Marketplace integrations
</p>

<p align="center">
  <a href="#-architecture">Architecture</a> · 
  <a href="#-tech-stack">Stack</a> · 
  <a href="#-monorepo-packages">Packages</a> · 
  <a href="#-erp-modules">Modules</a> · 
  <a href="#-database-schema">Schema</a> · 
  <a href="#-ai-pipeline">AI</a> · 
  <a href="#-security">Security</a> · 
  <a href="#-getting-started">Start</a>
</p>

<br/>

## 🏗 Architecture

### System Overview

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#2463eb', 'primaryTextColor': '#fff', 'primaryBorderColor': '#1d4ed8', 'lineColor': '#64748b', 'secondaryColor': '#f1f5f9', 'tertiaryColor': '#f8fafc', 'fontSize': '14px'}}}%%

graph TB
  classDef app fill:#2463eb,stroke:#1d4ed8,color:#fff,stroke-width:2px,font-weight:bold
  classDef pkg fill:#0f172a,stroke:#334155,color:#e2e8f0,stroke-width:2px
  classDef tool fill:#1e293b,stroke:#475569,color:#94a3b8,stroke-width:1px
  classDef infra fill:#059669,stroke:#047857,color:#fff,stroke-width:2px
  classDef external fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px

  subgraph APPS["▣  APPLICATIONS"]
    direction TB
    ERP["◆ apps/erp\nNext.js 16 · App Router · PWA\n19 modules · 13 forms · 2 hooks"]:::app
  end

  subgraph PACKAGES["◫  SHARED PACKAGES"]
    direction TB
    API["▸ @cendaro/api\ntRPC v11 · 11 domain routers\nRBAC middleware · Audit logger"]:::pkg
    DB["▸ @cendaro/db\nDrizzle ORM · 30+ tables\n8 schema phases · 20+ enums"]:::pkg
    AUTH["▸ @cendaro/auth\nSupabase SSR\nServer · Client · Middleware"]:::pkg
    UI["▸ @cendaro/ui\nshadcn/ui · Radix\nButton · Dialog · Sidebar · Forms"]:::pkg
    VAL["▸ @cendaro/validators\nZod v4 · Domain schemas\nRIF · Cédula · Money · RBAC"]:::pkg
  end

  subgraph TOOLING["⚙  TOOLING LAYER"]
    direction LR
    T1["ESLint 9\nFlat Config"]:::tool
    T2["Prettier 3\nImport Sort"]:::tool
    T3["TypeScript 5.9\nStrict ES2024"]:::tool
    T4["Tailwind 4\noklch Theme"]:::tool
  end

  subgraph INFRA["☁  INFRASTRUCTURE"]
    direction LR
    SB[("Supabase\nPostgreSQL\n+ Auth + Storage")]:::infra
    VCL["Vercel\nEdge Network\n+ Turbo Ignore"]:::external
    GROQ["Groq LPU\nQwen3-32B\nLlama 4 Scout"]:::external
  end

  ERP --> API
  ERP --> AUTH
  ERP --> UI
  ERP --> VAL
  API --> DB
  API --> VAL
  DB --> SB
  AUTH --> SB
  ERP -.-> VCL
  ERP -.-> GROQ
```

### Request Lifecycle

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#2463eb', 'actorTextColor': '#0f172a', 'actorBkg': '#e2e8f0', 'actorBorder': '#94a3b8', 'signalColor': '#334155', 'signalTextColor': '#0f172a', 'labelBoxBkgColor': '#f8fafc', 'labelBoxBorderColor': '#e2e8f0', 'noteBkgColor': '#eff6ff', 'noteBorderColor': '#bfdbfe', 'noteTextColor': '#1e40af', 'activationBkgColor': '#dbeafe', 'activationBorderColor': '#93c5fd', 'sequenceNumberColor': '#fff', 'fontSize': '13px'}}}%%

sequenceDiagram
  autonumber

  actor U as 🌐 Browser
  participant P as 🛡️ Proxy<br/>Auth Guard
  participant N as ⚡ Next.js 16<br/>App Router
  participant T as 🔒 tRPC v11<br/>RBAC Layer
  participant D as 💎 Drizzle<br/>ORM
  participant S as 🐘 Supabase<br/>PostgreSQL

  U->>+P: HTTPS Request
  Note right of P: Cookie validation<br/>Session refresh
  P->>P: Verify Supabase session

  alt Unauthenticated
    P-->>U: 302 → /login
  end

  P->>+N: Authenticated request
  N->>+T: tRPC procedure call

  Note right of T: Role-based access control<br/>owner > admin > supervisor > employee

  T->>T: Check user.role ∈ allowedRoles

  alt Unauthorized Role
    T-->>N: 403 Forbidden
  end

  T->>+D: Type-safe query builder
  D->>+S: Parameterized SQL
  S-->>-D: Result rows
  D-->>-T: Typed response objects
  T-->>-N: JSON + Superjson
  N-->>-P: RSC / HTML stream
  P-->>-U: Rendered page
```

### Monorepo File Tree

```
cendaro/
├── apps/
│   └── erp/                              ← Next.js 16 (App Router + PWA)
│       └── src/
│           ├── app/(app)/                 ← 19 authenticated route groups
│           ├── app/api/                   ← tRPC + AI + Auth endpoints
│           ├── components/                ← Sidebar, TopBar, Dialog, 13 forms
│           ├── hooks/                     ← useCurrentUser, useDebounce
│           ├── trpc/                      ← Client, server, query-client setup
│           └── proxy.ts                   ← Edge auth guard
│
├── packages/
│   ├── api/                              ← tRPC v11 business logic
│   │   └── src/modules/                  ← 11 domain routers
│   ├── auth/                             ← Supabase SSR (3 clients)
│   ├── db/                               ← Drizzle schema (30+ tables)
│   ├── ui/                               ← shadcn/ui components
│   └── validators/                       ← Zod v4 domain schemas
│
├── tooling/
│   ├── eslint/                           ← ESLint 9 flat config
│   ├── prettier/                         ← Import sorting + TW plugin
│   ├── typescript/                       ← Strict ES2024 base configs
│   └── tailwind/                         ← oklch theme + design tokens
│
├── turbo.json                            ← Turborepo pipeline (11 tasks)
├── vercel.json                           ← Deployment config
├── pnpm-workspace.yaml                   ← Workspace + dependency catalog
└── .husky/                               ← Git hooks (lint-staged)
```

---

## ⚡ Tech Stack

<table>
<tr>
<td width="50%">

### 🖥 Frontend & Framework

| | Technology | Version |
|-|-----------|---------|
| ⚡ | **Next.js** (App Router) | `16.1.6` |
| ⚛️ | **React** | `19.1.4` |
| 🟦 | **TypeScript** (strict) | `5.9.3` |
| 🎨 | **Tailwind CSS** v4 | `4.2.1` |
| 🧩 | **shadcn/ui** + Radix | new-york |
| 📊 | **TanStack Query** | `5.90.x` |

</td>
<td width="50%">

### ⚙️ Backend & Data

| | Technology | Version |
|-|-----------|---------|
| 🔌 | **tRPC** v11 | `11.12.0` |
| 💎 | **Drizzle** ORM | `0.45.1` |
| 🐘 | **Supabase** PostgreSQL | Managed |
| 🔐 | **Supabase Auth** SSR | `0.6.x` |
| ✅ | **Zod** v4 | `4.3.6` |
| 🤖 | **Groq** LPU (AI) | API |

</td>
</tr>
<tr>
<td>

### 🔧 Build & Quality

| | Technology | Version |
|-|-----------|---------|
| 🚀 | **Turborepo** | `2.8.14` |
| 📦 | **pnpm** | `10.30.3` |
| 🟢 | **Node.js** | `≥ 20 LTS` |
| 🔍 | **ESLint** 9 (flat) | `9.27.0` |
| ✨ | **Prettier** | `3.8.1` |
| 🐶 | **Husky** + lint-staged | Latest |

</td>
<td>

### 🚢 Deployment

| | Technology | Details |
|-|-----------|---------|
| ▲ | **Vercel** | Edge network |
| 🏗 | **turbo-ignore** | Smart build skipping |
| 🌍 | **dotenv-cli** | Env management |
| 📊 | **Sentry** | Error tracking (prod) |

</td>
</tr>
</table>

> **📌 Version policy:** All dependencies are centralized in `pnpm-workspace.yaml` → `catalog:` section. Pinned to latest verified stable — not bleeding-edge.

---

## 📦 Monorepo Packages

### `@cendaro/api` — Business Logic Layer

> End-to-end type-safe API with tRPC v11, RBAC middleware, and structured audit logging.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#1e293b', 'primaryTextColor': '#e2e8f0', 'primaryBorderColor': '#475569', 'lineColor': '#64748b', 'fontSize': '13px'}}}%%

graph LR
  classDef router fill:#1e293b,stroke:#475569,color:#e2e8f0,stroke-width:1px
  classDef core fill:#2463eb,stroke:#1d4ed8,color:#fff,stroke-width:2px

  ROOT["🔌 appRouter"]:::core

  ROOT --- A["📋 audit"]:::router
  ROOT --- B["📦 catalog"]:::router
  ROOT --- C["🚢 containers"]:::router
  ROOT --- D["📊 dashboard"]:::router
  ROOT --- E["🔗 integrations"]:::router
  ROOT --- F["📦 inventory"]:::router
  ROOT --- G["💰 pricing"]:::router
  ROOT --- H["🛒 sales"]:::router
  ROOT --- I["👤 users"]:::router
  ROOT --- J["🤝 vendors"]:::router
  ROOT --- K["💚 health"]:::router
```

| Router | Domain | Key Operations | Access |
|--------|--------|----------------|--------|
| `audit` | Event trail | Query immutable logs | 👑 Admin+ |
| `catalog` | Products, brands, categories, suppliers | Full CRUD, attribute management | 📋 Role-based |
| `containers` | Import tracking, AI packing lists | Create, receive, close, AI parse | 👑 Admin, 🔧 Supervisor |
| `dashboard` | Executive KPIs | Sales analytics, margin reports | 👑 Admin+ |
| `integrations` | Mercado Libre, WhatsApp | Order sync, listing management | 👑 Admin |
| `inventory` | Warehouses, stock, movements | Transfers, cycle counts, adjustments | 📋 Role-based |
| `pricing` | Rates, repricing events | Auto-repricing on BCV ≥ 5% change | 👑 Admin, 🔧 Supervisor |
| `sales` | Customers, orders, payments | Order lifecycle, multi-method payment | 📋 Role-based |
| `users` | Profiles, RBAC | Create, update roles/status | 👑 Admin, Owner |
| `vendors` | Portal, commissions, AR | Self-service orders, client management | 🤝 Vendor (self) |
| `health` | System status | Readiness check | 🌐 Public |

---

### `@cendaro/db` — Database & Schema

> 30+ tables, 20+ enums, 8 implementation phases — the entire data domain in one schema file.

<details>
<summary><strong>📊 Click to expand full schema map</strong></summary>

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#0f172a', 'primaryTextColor': '#e2e8f0', 'primaryBorderColor': '#334155', 'lineColor': '#475569', 'fontSize': '12px'}}}%%

graph TB
  classDef phase1 fill:#2463eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
  classDef phase2 fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
  classDef phase3 fill:#059669,stroke:#047857,color:#fff,stroke-width:2px
  classDef phase4 fill:#d97706,stroke:#b45309,color:#fff,stroke-width:2px
  classDef phase5 fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:2px
  classDef phase6 fill:#0891b2,stroke:#0e7490,color:#fff,stroke-width:2px
  classDef phase7 fill:#c026d3,stroke:#a21caf,color:#fff,stroke-width:2px
  classDef phase8 fill:#e11d48,stroke:#be123c,color:#fff,stroke-width:2px

  subgraph P1["◆ PHASE 1 — Identity & RBAC"]
    O[Organization]:::phase1
    UP[UserProfile]:::phase1
    PM[Permission]:::phase1
    RP[RolePermission]:::phase1
    AL[AuditLog]:::phase1
  end

  subgraph P2["◆ PHASE 2 — Catalog"]
    BR[Brand]:::phase2
    CT[Category]:::phase2
    SP[Supplier]:::phase2
    PR[Product]:::phase2
    PA[ProductAttribute]:::phase2
    PP[ProductPrice]:::phase2
  end

  subgraph P3["◆ PHASE 3 — Inventory & Containers"]
    WH[Warehouse]:::phase3
    SL[StockLedger]:::phase3
    CA[ChannelAllocation]:::phase3
    SM[StockMovement]:::phase3
    IC[InventoryCount]:::phase3
    CN[Container]:::phase3
    CI[ContainerItem]:::phase3
    APC[AiPromptConfig]:::phase3
  end

  subgraph P4["◆ PHASE 4 — Pricing Engine"]
    ER[ExchangeRate]:::phase4
    PH[PriceHistory]:::phase4
    RE[RepricingEvent]:::phase4
  end

  subgraph P5["◆ PHASE 5 — Sales & Payments"]
    CU[Customer]:::phase5
    OR[Order]:::phase5
    OI[OrderItem]:::phase5
    PY[Payment]:::phase5
    CC[CashClosure]:::phase5
  end

  subgraph P6["◆ PHASE 6 — Vendor Portal"]
    VC[VendorCommission]:::phase6
    AR[AccountsReceivable]:::phase6
    AP[ARPayment]:::phase6
  end

  subgraph P7["◆ PHASE 7 — Integrations"]
    ML[MlListing]:::phase7
    MO[MlOrder]:::phase7
    IL[IntegrationLog]:::phase7
  end

  subgraph P8["◆ PHASE 8 — Alerts"]
    SA[SystemAlert]:::phase8
  end

  O --> UP
  UP --> AL
  BR --> PR
  CT --> PR
  SP --> PR
  PR --> PA
  PR --> PP
  WH --> SL
  PR --> SL
  PR --> CA
  PR --> SM
  SP --> CN
  CN --> CI
  PR --> CI
  PR --> PH
  ER --> RE
  CU --> OR
  OR --> OI
  OR --> PY
  UP --> VC
  CU --> AR
```

</details>

| Phase | Color | Domain | Tables |
|:-----:|:-----:|--------|--------|
| **1** | 🔵 | Identity & RBAC | `organization` · `user_profile` · `permission` · `role_permission` · `audit_log` |
| **2** | 🟣 | Catalog | `brand` · `category` · `supplier` · `product` · `product_attribute` · `product_price` |
| **3** | 🟢 | Inventory & Containers | `warehouse` · `stock_ledger` · `channel_allocation` · `stock_movement` · `inventory_count` · `container` · `container_item` · `ai_prompt_config` |
| **4** | 🟠 | Pricing Engine | `exchange_rate` · `price_history` · `repricing_event` |
| **5** | 🔴 | Sales & Payments | `customer` · `order` · `order_item` · `payment` · `cash_closure` |
| **6** | 🔷 | Vendor Portal & AR | `vendor_commission` · `accounts_receivable` · `ar_payment` |
| **7** | 🟪 | Integrations | `ml_listing` · `ml_order` · `integration_log` |
| **8** | 💗 | Alerts | `system_alert` · `dashboard_kpi` |

---

### `@cendaro/auth` — Authentication

> Supabase Auth SSR with three specialized clients for the Next.js App Router lifecycle.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#059669', 'primaryTextColor': '#fff', 'primaryBorderColor': '#047857', 'lineColor': '#64748b', 'fontSize': '13px'}}}%%

graph LR
  classDef server fill:#059669,stroke:#047857,color:#fff,stroke-width:2px
  classDef client fill:#2463eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
  classDef edge fill:#d97706,stroke:#b45309,color:#fff,stroke-width:2px

  S["🖥 server.ts\nServer Components\nRSC data fetching"]:::server
  C["🌐 client.ts\nClient Components\nReact hooks"]:::client
  M["⚡ middleware.ts\nEdge Runtime\nproxy.ts guard"]:::edge

  S --> SB[("🔐 Supabase Auth")]
  C --> SB
  M --> SB
```

---

### `@cendaro/ui` — Component Library

> Design system built on shadcn/ui (new-york) + Radix — accessible, composable, themed.

| Category | Components |
|----------|-----------|
| **Layout** | `Sidebar` · `TopBar` · `Dialog` |
| **Controls** | `Button` (7 variants × 4 sizes) · `ThemeToggle` |
| **Auth** | `RoleGuard` — RBAC-based conditional rendering |
| **Forms (13)** | `CreateProduct` · `EditProduct` · `CreateOrder` · `UpdateOrderStatus` · `CreateCustomer` · `CreateContainer` · `CreateBrand` · `CreateCategory` · `CreateSupplier` · `CreateClosure` · `CycleCount` · `TransferStock` · `EditUser` |
| **Utilities** | `cn()` — Tailwind Merge + clsx |

---

### `@cendaro/validators` — Domain Validation

> Venezuelan business domain schemas shared across frontend and backend via Zod v4.

| Schema | Pattern | Example |
|--------|---------|---------|
| `rifSchema` | `^[JVGEP]-\d{8}-\d$` | `J-12345678-9` |
| `cedulaSchema` | `^[VE]-\d{6,8}$` | `V-1234567` |
| `moneySchema` | `≥ 0, max 2 decimals` | `100.50` |
| `exchangeRateSchema` | `> 0, max 4 decimals` | `36.5812` |
| `percentageSchema` | `0 – 100` | `15` |
| `skuCodeSchema` | `1–64 chars` | `SKU-001` |
| `userRoleSchema` | 6 enum values | `owner` `admin` `supervisor` `employee` `vendor` `marketing` |

---

## 🖥 ERP Modules

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#2463eb', 'primaryTextColor': '#fff', 'primaryBorderColor': '#1d4ed8', 'lineColor': '#475569', 'fontSize': '12px'}}}%%

graph TB
  classDef core fill:#2463eb,stroke:#1d4ed8,color:#fff,stroke-width:2px,font-weight:bold
  classDef commerce fill:#059669,stroke:#047857,color:#fff,stroke-width:2px
  classDef integr fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
  classDef mgmt fill:#d97706,stroke:#b45309,color:#fff,stroke-width:2px

  subgraph CORE["▣ CORE OPERATIONS"]
    direction LR
    D["/dashboard\n📊 Executive KPIs"]:::core
    CAT["/catalog\n📦 Products"]:::core
    INV["/inventory\n📦 Stock Control"]:::core
    CON["/containers\n🚢 Imports + AI"]:::core
    POS["/pos\n🛒 Point of Sale"]:::core
    RAT["/rates\n💱 Exchange Rates"]:::core
    PRI["/pricing\n💰 Pricing Engine"]:::core
  end

  subgraph COMMERCE["▣ COMMERCE"]
    direction LR
    ORD["/orders\n📋 Order Mgmt"]:::commerce
    CUS["/customers\n👥 Registry"]:::commerce
    PAY["/payments\n💳 Processing"]:::commerce
    CSH["/cash-closure\n🏦 Daily Close"]:::commerce
    VEN["/vendors\n🤝 Vendor Portal"]:::commerce
    ACC["/accounts-receivable\n📊 AR Tracking"]:::commerce
  end

  subgraph INTEGRATIONS["▣ INTEGRATIONS & MANAGEMENT"]
    direction LR
    MKT["/marketplace\n🛍 Mercado Libre"]:::integr
    WHA["/whatsapp\n💬 WhatsApp"]:::integr
    USR["/users\n👤 RBAC"]:::mgmt
    AUD["/audit\n📜 Event Log"]:::mgmt
    ALR["/alerts\n🔔 System Alerts"]:::mgmt
    SET["/settings\n⚙ Config"]:::mgmt
  end
```

| # | Route | Module | Status |
|:-:|-------|--------|:------:|
| 1 | `/dashboard` | Executive Dashboard — KPI widgets, charts, filters | ✅ |
| 2 | `/catalog` | Product Catalog — CRUD, brands, categories, suppliers | ✅ |
| 3 | `/inventory` | Inventory Control — stock ledger, movements, cycle counts | ✅ |
| 4 | `/containers` | Container Management — import tracking, AI packing list parser | ✅ |
| 5 | `/pos` | Point of Sale — scanner, cart, payment registration | ✅ |
| 6 | `/rates` | Exchange Rates — BCV, parallel, RMB rates dashboard | ✅ |
| 7 | `/pricing` | Pricing Engine — repricing events, price history | ✅ |
| 8 | `/orders` | Order Management — create, status workflow, dispatch | ✅ |
| 9 | `/customers` | Customer Registry — types, credit limits, history | ✅ |
| 10 | `/payments` | Payment Processing — multi-method, evidence upload | ✅ |
| 11 | `/cash-closure` | Daily Cash Closure — reconciliation, approval | ✅ |
| 12 | `/vendors` | Vendor Portal — self-service orders, commissions | ✅ |
| 13 | `/accounts-receivable` | Accounts Receivable — AR tracking, aging, payments | ✅ |
| 14 | `/marketplace` | Mercado Libre — listing sync, order import | ✅ |
| 15 | `/whatsapp` | WhatsApp Sales — assisted sales channel | ✅ |
| 16 | `/users` | User Management — RBAC, profiles, status | ✅ |
| 17 | `/audit` | Audit Log — immutable event trail | ✅ |
| 18 | `/alerts` | System Alerts — low stock, rate changes, overdue AR | ✅ |
| 19 | `/settings` | Configuration — organization, preferences | ✅ |

---

## 🗄 Database Schema

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#1e293b', 'primaryTextColor': '#e2e8f0', 'lineColor': '#475569', 'fontSize': '12px'}}}%%

erDiagram
  Organization ||--o{ UserProfile : "employs"
  UserProfile ||--o{ AuditLog : "creates"
  UserProfile ||--o{ VendorCommission : "earns"

  Brand ||--o{ Product : "brands"
  Category ||--o{ Product : "classifies"
  Supplier ||--o{ Product : "supplies"
  Product ||--o{ ProductAttribute : "describes"
  Product ||--o{ ProductPrice : "priced as"

  Warehouse ||--o{ StockLedger : "stores"
  Product ||--o{ StockLedger : "stocked in"
  Product ||--o{ ChannelAllocation : "allocated to"
  Product ||--o{ StockMovement : "tracked by"

  Supplier ||--o{ Container : "ships"
  Container ||--o{ ContainerItem : "contains"
  Product ||--o{ ContainerItem : "referenced"

  ExchangeRate }o--|| RepricingEvent : "triggers"
  Product ||--o{ PriceHistory : "price logged"

  Customer ||--o{ Order : "places"
  Order ||--o{ OrderItem : "includes"
  Order ||--o{ Payment : "paid via"
  Customer ||--o{ AccountsReceivable : "owes"
```

---

## 🤖 AI Pipeline

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#7c3aed', 'primaryTextColor': '#fff', 'primaryBorderColor': '#6d28d9', 'lineColor': '#64748b', 'fontSize': '13px'}}}%%

graph LR
  classDef tier1 fill:#2463eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
  classDef tier2 fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
  classDef tier3 fill:#059669,stroke:#047857,color:#fff,stroke-width:2px
  classDef store fill:#d97706,stroke:#b45309,color:#fff,stroke-width:2px

  subgraph T1["TIER 1 · Client"]
    A["📄 Excel Upload\n130MB+ files"]:::tier1
    B["⚙ Client-side\nText Extraction"]:::tier1
  end

  subgraph T2["TIER 2 · API"]
    C["📡 Chunked\nJSON Upload"]:::tier2
    D["🔀 Chunk\nOrchestrator"]:::tier2
  end

  subgraph T3["TIER 3 · AI"]
    E["🤖 Groq LPU\nQwen3-32B"]:::tier3
    F["🧠 Context-Aware\nMatching Engine"]:::tier3
    G["👁 Vision API\nImage Analysis"]:::tier3
  end

  H[("💾 Supabase\nStorage")]:::store

  A --> B --> C --> D
  D --> E --> F
  D --> H --> G --> F
  F --> |"matched items"| DB[("📊 Database\ncontainer_item")]:::store
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Text Extraction** | Client-side Excel parsing | Parse large files (130MB+) in the browser |
| **Translation** | Groq LPU · Qwen3-32B | Translate Chinese → Spanish, normalize names |
| **Product Matching** | Context-aware scoring · `AiPromptConfig` | Match parsed items to catalog with confidence scores |
| **Image Processing** | Supabase Storage + Groq Vision | Extract product details from packing list images |
| **Fallback Model** | Llama 4 Scout | Secondary model for rate-limit recovery |

---

## 🔐 Security

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#dc2626', 'primaryTextColor': '#fff', 'primaryBorderColor': '#b91c1c', 'lineColor': '#64748b', 'fontSize': '13px'}}}%%

graph TB
  classDef auth fill:#059669,stroke:#047857,color:#fff,stroke-width:2px
  classDef rbac fill:#2463eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
  classDef data fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
  classDef audit fill:#d97706,stroke:#b45309,color:#fff,stroke-width:2px

  subgraph L1["🔒 LAYER 1 — AUTHENTICATION"]
    A1["Supabase Auth SSR\nEmail/Password"]:::auth
    A2["Cookie-based Sessions\nHTTPOnly + Secure"]:::auth
    A3["Proxy Guard\nEdge Runtime"]:::auth
  end

  subgraph L2["🛡 LAYER 2 — AUTHORIZATION"]
    B1["tRPC RBAC Middleware\nroleRestrictedProcedure"]:::rbac
    B2["6 Role Levels\n👑 owner → admin → supervisor\n👤 employee · vendor · marketing"]:::rbac
  end

  subgraph L3["🔐 LAYER 3 — DATA ISOLATION"]
    C1["Supabase RLS Policies\nRow-Level Security"]:::data
    C2["Vendor Data Isolation\nOrg-Level Scoping"]:::data
    C3["Service-Role Key\nPrivileged Operations"]:::data
  end

  subgraph L4["📜 LAYER 4 — AUDIT TRAIL"]
    D1["audit_log\nImmutable Event Store"]:::audit
    D2["stock_movement\nInventory Trail"]:::audit
    D3["price_history\nPricing Trail"]:::audit
  end

  L1 --> L2 --> L3 --> L4
```

---

## 🎨 Design System

<table>
<tr>
<td width="50%">

### 🎯 Color Palette

| Token | Value | Preview |
|-------|-------|:-------:|
| **Primary** | `#2463eb` (oklch) | 🔵 |
| **Success** | `oklch(0.70 0.15 145)` | 🟢 |
| **Warning** | `oklch(0.75 0.15 75)` | 🟡 |
| **Destructive** | `oklch(0.55 0.2 25)` | 🔴 |

</td>
<td width="50%">

### 🖌 Design Tokens

| Token | Value |
|-------|-------|
| **Typography** | Inter (Google Fonts) |
| **Shadows** | 5-level (`xs` → `2xl`) |
| **Dark Mode** | Class-based (`.dark`) |
| **Border Radius** | Consistent system |
| **Spacing** | Tailwind v4 scale |

</td>
</tr>
</table>

> Defined in `tooling/tailwind/theme.css` — imported globally via `@import "@cendaro/tailwind-config/theme"`.

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|------------|---------|
| **Node.js** | ≥ 20.0.0 (see `.nvmrc`) |
| **pnpm** | 10.30.3 |
| **Supabase** | Project with PostgreSQL |

### Installation

```bash
# 1. Clone & install
git clone <repo-url> cendaro && cd cendaro
pnpm install

# 2. Configure environment
cp .env.example .env
# → Edit .env with Supabase credentials

# 3. Push schema to database
pnpm db:push

# 4. Start development
pnpm dev          # All packages in watch mode
pnpm dev:erp      # ERP app only
```

### Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (backend) |
| `SENTRY_DSN` | — | Error tracking (production) |
| `MERCADOLIBRE_APP_ID` | — | Mercado Libre OAuth |
| `MERCADOLIBRE_SECRET` | — | Mercado Libre OAuth |
| `MERCADOLIBRE_REDIRECT_URI` | — | Mercado Libre callback URL |

---

## 📜 Scripts

<table>
<tr>
<td width="50%">

### 🔨 Development

| Script | Description |
|--------|-------------|
| `pnpm dev` | All packages — watch mode |
| `pnpm dev:erp` | ERP app + dependencies |
| `pnpm build` | Production build |

</td>
<td width="50%">

### ✅ Quality

| Script | Description |
|--------|-------------|
| `pnpm typecheck` | TypeScript verification |
| `pnpm lint` | ESLint (type-checked) |
| `pnpm format` | Prettier check |
| `pnpm test` | Test suites |

</td>
</tr>
<tr>
<td>

### 🗄 Database

| Script | Description |
|--------|-------------|
| `pnpm db:push` | Push schema → Supabase |
| `pnpm db:generate` | Generate migrations |
| `pnpm db:studio` | Drizzle Studio GUI |

</td>
<td>

### 🧩 UI

| Script | Description |
|--------|-------------|
| `pnpm ui-add` | Add shadcn/ui component |
| `pnpm lint:fix` | Auto-fix all lint |
| `pnpm format:fix` | Auto-format all |

</td>
</tr>
</table>

---

## 🗺 Roadmap

| Phase | Domain | Status |
|:-----:|--------|:------:|
| **0** | Foundation — monorepo, tooling, design system | ✅ |
| **1** | Schema, RBAC, audit trail, permissions | ✅ |
| **2** | Catalog, inventory, containers, AI pipeline | ✅ |
| **3** | Pricing engine, exchange rates, auto-repricing | ✅ |
| **4** | Sales, payments, cash closure, order workflow | ✅ |
| **5** | Mercado Libre + WhatsApp integrations | ✅ |
| **6** | Executive dashboard, vendor portal, commissions | ✅ |
| **7** | Testing, hardening, CI/CD, Git lifecycle | ✅ |
| **8** | Dashboard KPIs, system alerts, AI inference | ✅ |

---

## 📄 Documentation

| Document | Purpose |
|----------|---------|
| **README.md** | Technical reference (this file) |
| **PRD.md** | Product requirements (26 sections) |
| `.agents/workflows/` | Developer workflows & automation |

> **Sync policy:** Critical changes must be verified against the PRD and reflected here. See `.agents/workflows/prd-sync.md`.

---

<p align="center">
  <sub><strong>Cendaro</strong> © 2026 — Built with ❤️ for Venezuelan commerce</sub>
</p>
