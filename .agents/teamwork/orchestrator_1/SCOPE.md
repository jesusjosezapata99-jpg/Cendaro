# Scope: Cendaro ERP Comprehensive Cybersecurity Deep Audit & Threat Modeling

## Architecture & Attack Surface

Cendaro is an omnichannel ERP monorepo built with Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4.2, tRPC v11, Drizzle ORM 0.45, and Supabase.

- `apps/erp/`: Next.js 16 ERP app, public landing pages, SSR layouts, server actions, route handlers.
- `packages/api/`: tRPC v11 routers, procedure authorization builders, business & transactional logic.
- `packages/auth/`: Supabase SSR authentication helpers, cookie handlers, session extraction.
- `packages/db/`: Drizzle schemas, multi-tenant tables, SQL migrations, Row Level Security (RLS) policies.
- `packages/validators/`: Zod schemas, role/permission matrix (`ROLE_PERMISSIONS`).
- `tooling/` & `scripts/checks/`: Guard scripts (`design-guard`, `smoke routes`, `procedure-authz-coverage.test.ts`).

## Audit Stream Breakdown

| #   | Stream / Target                    | Focus Areas                                                         | Key Risks & Vectors                                                                                                         |
| --- | ---------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Auth, Tenancy & Database RLS       | `packages/auth`, `packages/db`, Supabase RLS, `packages/validators` | Cross-tenant data exfiltration, RLS bypass, privilege escalation, session forgery, broken object level authorization (BOLA) |
| 2   | tRPC Endpoints & Pricing Logic     | `packages/api`, all routers, order/billing logic                    | Price tampering, negative quantities, discount abuse, unauthenticated tRPC procedures, business logic flaws                 |
| 3   | Frontend, Landing & Public Surface | `apps/erp`, SSR/RSC data leaks, public routes, server actions       | Secret leakage in client bundles, CSRF, insecure direct object references, injection via imports/uploads                    |
| 4   | Empirical Verification             | Repo test suites, authz coverage, typecheck                         | Broken procedure authorization, unverified role requirements                                                                |

## Output Requirements

- Exhaustive documentation of all vulnerabilities across every module.
- Exact file paths, lines of code, and architectural components.
- Threat classification (OWASP Top 10, CWE, CVSS v3.1 severity rating).
- Real-world exploitation scenario (Data theft, price manipulation, unauthorized access).
- Step-by-step technical remediation plan (architectural changes, policy fixes, input sanitization, test additions) with zero code modifications in this phase.
