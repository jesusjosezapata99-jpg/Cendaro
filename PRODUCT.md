# Product

<!-- impeccable:product-schema 1 -->

> Product truth for Cendaro. Every public claim, plan and page must be consistent with this file; every capability below cites the code that proves it.
> Owner decisions are dated (`user:YYYY-MM-DD`). Last reviewed 2026-09-25.

## Platform

web — responsive (desktop operations, tablet POS, phone for owners and field sellers). No native app.

## One-line definition

Cendaro is the operating system of a Venezuelan distributor: catalog, stock, imports, sales, collections and exchange rates in one system, in dollars and bolívares, without spreadsheets.

## Users

### Ideal customer (ICP)

Wholesale distributors and multi-channel retailers in Venezuela with 2–50 people, 200–20 000 SKUs, one or more warehouses, sales at the counter, by order and through sellers in the street, prices in USD and collection in bolívares, and merchandise imported in containers (often from China). Today they run on Excel, notebooks, WhatsApp chats and a separate fiscal tool.

### People inside a company (roles in code: `USER_ROLES`, `packages/validators/src/index.ts`)

| Person                      | Role         | Job to be done                                                                                             |
| :-------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------- |
| Owner                       | `owner`      | Know at any moment what is in stock, what is owed, what was sold and at which rate — and trust the number. |
| Administrator               | `admin`      | Keep prices, rates, users and settings right without chasing people.                                       |
| Supervisor / warehouse lead | `supervisor` | Receive merchandise, count stock, approve adjustments, run the day.                                        |
| Cashier / sales floor       | `employee`   | Sell fast at the counter, register the customer's fiscal data, close the cash drawer.                      |
| Field seller                | `vendor`     | Take orders and quotes for their own customers and see their own commissions.                              |
| Marketplace operator        | `marketing`  | Keep the Mercado Libre listings in line with stock.                                                        |

### Public-site visitor

The owner or manager deciding whether Cendaro can replace their spreadsheets (confirmed `user:2026-09-24`). Usually on a phone first, then on a desktop; often on a slow or metered connection.

## Product Purpose

Remove the manual reconciliation that a dual-currency, importing distributor lives with: copying the rate, re-pricing by hand, transcribing packing lists, counting stock on paper, chasing receivables in a notebook. Success means the business numbers — stock, prices in USD and Bs, receivables, daily cash — are correct and visible without anyone reconciling them.

## Positioning

**For** Venezuelan distributors and retailers **who** sell in dollars, collect in bolívares and import their merchandise, **Cendaro is** the ERP built for that reality: the BCV rate synchronized every day and held for approval when it jumps, SENIAT fiscal data on every customer, container packing lists read by AI, and per-action permissions for every role — in one system. **Unlike** spreadsheets or generic ERPs adapted from other markets, the dual-currency flow and the import flow are native, not workarounds.

### Differentiators (each must stay provable)

1. **Dual currency, native.** Prices in USD, conversion to Bs with the official rate synchronized daily; a variation above 15 % waits 24 h for a human (`packages/validators/src/rates.ts`, `packages/api/src/modules/rate-sync.ts`).
2. **Imports without transcription.** Packing lists in PDF or Excel — including the product photos inside the Excel — are read by AI and matched to the catalog (`apps/erp/src/app/api/ai/parse-packing-list/route.ts`, `packages/api/src/modules/containers.ts`).
3. **Every role sees only its part.** 18 modules × 6 roles × 6 actions, enforced on the server; field sellers only see their own customers, orders and commissions (`packages/validators/src/authz.ts`, `packages/api/src/modules/vendor-scope.ts`).
4. **Controlled changes.** Stock counts, repricing and held rates go through approval; every change is in the audit log (`approvals.ts`, `audit-router.ts`).
5. **Isolated and protected data.** Row-level security per company, TOTP two-factor, idle-session timeout, login lockout (`packages/db/migrations/016-022`, `apps/erp/src/app/api/auth/login/route.ts`).

## Capabilities (verified in code, 2026-09-25)

| Area                 | What it does today                                                                                                                                                                                                   | Source                                                                                |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| Catalog              | Products, brands, categories, suppliers, prices, attributes; Excel import with column aliases, validation, dry run and fuzzy category suggestions (not AI)                                                           | `packages/api/src/modules/catalog.ts`, `catalog-import.ts`                            |
| Inventory            | Multiple warehouses, stock overview, transfers, locks, movements, stock edits, physical counts with approval; Excel stock import                                                                                     | `inventory.ts`, `inventory-import.ts`                                                 |
| Containers (imports) | Containers with status flow, items, packing-list reading with AI (`.xlsx`, `.xls`, `.pdf`; vision on images embedded in Excel, up to 20), catalog matching and corrections                                           | `containers.ts`, `apps/erp/src/app/api/ai/parse-packing-list/route.ts`                |
| Rates                | BCV (bcv.org.ve, DolarAPI fallback), parallel (DolarAPI) and USD/CNY (Frankfurter, ExchangeRate-API); daily cron at 22:00 UTC (6:00 p. m. Venezuela); >15 % change held 24 h for approval                            | `rate-sync.ts`, `packages/validators/src/rates.ts`, `vercel.json`                     |
| Pricing              | Rate history, currency conversion, repricing events with approval                                                                                                                                                    | `pricing.ts`                                                                          |
| Sales                | Customers with fiscal data (RIF/cédula), orders with status flow, POS checkout, quotes converted to orders, delivery notes                                                                                           | `sales.ts`, `quotes.ts`                                                               |
| Payments & cash      | Payments with validation, daily cash closures with review                                                                                                                                                            | `payments.ts`, `sales.ts`                                                             |
| Receivables          | Accounts receivable, installments, mark paid, summary; seller commissions                                                                                                                                            | `receivables.ts`, `vendors.ts`                                                        |
| Channels             | WhatsApp: order and customer lists with `wa.me` links and prefilled messages (manual, no API). Mercado Libre: listings and orders recorded next to stock; stock/price sync recorded locally (no live API connection) | `whatsapp/client.tsx`, `integrations.ts`                                              |
| Reporting            | Sales summary, by channel, payment methods, inventory valuation, top products                                                                                                                                        | `reporting.ts`, `dashboard.ts`                                                        |
| Control              | 18 modules, role × action matrix, approvals, audit log, alerts, global search, companies (workspaces) with members and invitations                                                                                   | `packages/validators/src/authz.ts`, `approvals.ts`, `audit-router.ts`, `workspace.ts` |
| Security             | Postgres RLS per workspace, TOTP two-factor, idle-session timeout (30 min), login rate limiting and lockout                                                                                                          | `packages/db/migrations/016-022`, `apps/erp/src/app/api/auth/login/route.ts`          |

### What Cendaro does NOT do (never claim it)

- No public self-service signup, no free trial, no online payment of the subscription.
- No billing integration (Stripe or other), no Google Sheets integration, no public API.
- No automatic WhatsApp messages (links only) and no live Mercado Libre connection.
- No AI categorization of the catalog (fuzzy suggestions only); the AI reads packing lists.
- No compliance certifications (SOC 2, ISO) and no GDPR programme.
- No customer testimonials or usage metrics exist yet.

## Offer and plans (`user:2026-09-25`)

The owner delegated the commercial offer ("inventa algo a nivel avanzado para la captación de clientes"). Principles: no public prices (D2); every plan is built only from real modules; entry is guided, not self-service; the offer lowers the cost of trying and makes the migration the company's problem, not the customer's.

|            | **Starter**                                                                                                                      | **Pro** (recommended)                                                                                                                             | **Empresa**                                            |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------- |
| For        | A store or small distributor getting out of Excel                                                                                | A distributor that imports and sells in several channels                                                                                          | Operations with several warehouses, teams or companies |
| Modules    | Code-defined `STARTER_MODULES`: dashboard, catalog, inventory, orders, POS, customers, payments (+ core: users, settings, audit) | Starter + containers with AI, pricing and repricing, automatic rates, receivables, cash closure, sellers and commissions, WhatsApp, Mercado Libre | All 18 modules                                         |
| Limits     | Code-defined `STARTER_QUOTA`: 1 user, 1 warehouse, 500 products, 50 customers, 500 MB                                            | 10 users, 3 warehouses, unlimited products and customers                                                                                          | Unlimited users and warehouses; several companies      |
| Onboarding | Guided activation                                                                                                                | Assisted migration of catalog and stock from Excel                                                                                                | Assisted migration + role design + team training       |
| Support    | WhatsApp, business hours                                                                                                         | Priority WhatsApp                                                                                                                                 | Dedicated contact                                      |

Acquisition devices (all service promises the owner must honour):

1. **Free operations diagnosis (30 min)** — before any sale, a call to map how the business works today.
2. **"Your Excel, our problem"** — Pro and Empresa: the team loads the catalog and opening stock from the customer's files.
3. **First-week accompaniment** — daily check-in during the first week of use.
4. **No lock-in** — the customer can export their data at any time (`users.exportMyData` covers personal data; full company export is a commitment, not yet a feature).

Plan limits other than Starter are commercial terms, set per company by the team (`workspace_quota`); they are not self-enforced plan tiers in code.

## Conversion

- Primary action: **"Solicitar acceso"** → WhatsApp (`wa.me` with a prefilled message naming the page or plan) with email fallback; nothing is stored (`user:2026-09-24`). Configured by `NEXT_PUBLIC_CONTACT_WHATSAPP` / `NEXT_PUBLIC_CONTACT_EMAIL`; while both are unset the site shows "Iniciar sesión" only.
- Secondary action: **"Iniciar sesión"** for existing customers.

## Constraints

- Truth rule: public pages publish only facts verifiable in code or dated owner decisions; enforced by `apps/erp/src/app/_components/landing/content.guard.test.ts`.
- Canonical site URL from `NEXT_PUBLIC_SITE_URL`, fallback `https://cendaro-erp.vercel.app`; the domain `cendaro.io` is planned.
- Audience on variable networks: the public site must stay fast on slow 4G (performance budgets in `~/.claude/plans/PLAN-2026-09-LANDING-REDESIGN.md` §5).

## Voice

Spanish as spoken in Venezuela: direct, concrete, operational — the voice of someone who has run a warehouse. Short sentences, verbs first, numbers over adjectives.

| Use                                                                                                                | Avoid                                                                                    |
| :----------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| Funciones, Planes, Solicitar acceso, Iniciar sesión                                                                | Features, Pricing, Get started, "Empezar gratis"                                         |
| tasa BCV, bolívares (Bs), dólares (USD), RIF, cédula, packing list, contenedor, cierre de caja, cuentas por cobrar | "revolucionario", "potenciado por IA", "solución integral", "todo en uno" without a list |
| "La tasa BCV se sincroniza sola cada día"                                                                          | "Automatización inteligente de procesos"                                                 |
| Money as `USD 1.234,50` / `Bs 45.678,90` (`es-VE`)                                                                 | Invented figures, percentages or time savings                                            |

## Glossary

- **Tasa BCV**: official USD/Bs rate published by the Banco Central de Venezuela.
- **Tasa paralela**: market rate (DolarAPI); informative.
- **Packing list**: supplier document listing the contents of a container.
- **RIF / cédula**: tax ID of a company / identity number of a person (SENIAT).
- **Cierre de caja**: end-of-day reconciliation of the cash drawer.
- **Workspace / empresa**: an isolated company inside Cendaro.

## Open Decisions

- WhatsApp number and contact email (variables ready; unset today).
- Vector (SVG) logo; real social profiles; legal texts (privacy, terms).
- Customer testimonials, only with written permission.
