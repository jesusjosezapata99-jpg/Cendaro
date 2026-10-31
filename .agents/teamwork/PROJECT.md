# Project: Cendaro ERP Critical Audit & Strategic Transformation Plan

## Architecture

Cendaro is an omnichannel ERP for wholesale and retail commerce: a pnpm + Turborepo monorepo with Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4.2, tRPC v11, Drizzle ORM 0.45 and Supabase, deployed on Vercel.

- `apps/erp/`: Next.js ERP app (@cendaro/erp)
- `packages/api/`: tRPC routers and business logic (@cendaro/api)
- `packages/auth/`: Supabase SSR auth helpers (@cendaro/auth)
- `packages/db/`: Drizzle schema and client (@cendaro/db)
- `packages/ui/`: shadcn/ui + Radix components, icons, StatusPill (@cendaro/ui)
- `packages/validators/`: Zod schemas and role/permission matrix (@cendaro/validators)
- `tooling/`: ESLint, Prettier, Tailwind tokens, TSConfig
- `scripts/checks/`: Guard scripts

## Feature Inventory

| #   | Feature / Area                           | Description                                                                                   | Milestone | Source           |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------- | --------- | ---------------- |
| 1   | R1: Security & Auth Audit                | Role matrix, tRPC authz procedures, Supabase RLS, SSR auth, tokens, attack surfaces           | M1        | ORIGINAL_REQUEST |
| 2   | R1: Scalability & Architecture           | Monorepo structure, database connection pooling, cold starts, queueing/jobs, state management | M1        | ORIGINAL_REQUEST |
| 3   | R2: Employee Modules Functional Audit    | All employee-facing modules in apps/erp (POS, Inventory, Orders, CRM, HR, etc.)               | M2        | ORIGINAL_REQUEST |
| 4   | R2: Module Interconnection & Gaps        | tRPC route coverage, cross-module data flow, pending tasks for 100% operational state         | M2        | ORIGINAL_REQUEST |
| 5   | R2: Ergonomics & Visual Navigation       | Access speed, design system compliance, employee usability                                    | M2        | ORIGINAL_REQUEST |
| 6   | R3: DB & Query Latency                   | Supabase query latency, N+1 issues, connection overhead, roundtrips                           | M3        | ORIGINAL_REQUEST |
| 7   | R3: Latency & Cloud from Venezuela       | Latency impacts (>150-300ms), packet loss, offline resilience, caching strategies             | M3        | ORIGINAL_REQUEST |
| 8   | R3: Animation Fluency & UI Performance   | CSS transitions, JS overhead, frame drops under low bandwidth/high jitter                     | M3        | ORIGINAL_REQUEST |
| 9   | Repo Health Checks Execution             | Running `pnpm typecheck`, `pnpm lint`, `pnpm test`, `design-guard.mjs`                        | M0        | ORIGINAL_REQUEST |
| 10  | R4: Strategic Transformation Master Plan | Consolidated professional plan with prioritized technical proposals (zero code edit)          | M4        | ORIGINAL_REQUEST |

## Milestones

| #   | Name                                   | Scope                                                                       | Dependencies   | Status |
| --- | -------------------------------------- | --------------------------------------------------------------------------- | -------------- | ------ |
| M0  | Repo Diagnostics Runner                | Execute repo verification checks and capture raw outputs                    | none           | DONE   |
| M1  | Security & Scalability Audit           | Comprehensive audit of auth, RLS, API security, and scalability bottlenecks | none           | DONE   |
| M2  | Functional & Employee UX Audit         | Comprehensive audit of employee modules, gaps to 100%, and UX               | none           | DONE   |
| M3  | Latency, Venezuela & Performance Audit | Audit of database latency, cloud connection from Venezuela, and animations  | none           | DONE   |
| M4  | Master Strategic Plan Consolidation    | Consolidated technical roadmap, prioritized actions, architecture proposals | M0, M1, M2, M3 | DONE   |

## Code Layout & Guardrails

- Strictly READ-ONLY phase: no application files or source code in `apps/` or `packages/` may be edited.
- All agent metadata and reports are stored under `.agents/teamwork/`.
