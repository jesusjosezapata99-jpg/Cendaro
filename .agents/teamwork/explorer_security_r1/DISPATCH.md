# DISPATCH — explorer_security_r1

## Assignment

Execute R1: Critical Security & Scalability Audit of Cendaro ERP.

### Working Directory

`c:\Users\jzs99\Desktop\TEST\.agents\teamwork\explorer_security_r1\`

### Scope of Investigation

1. **Authentication & Authorization**:
   - `packages/auth/`: Supabase SSR auth helpers, cookie handling, session management, token refresh.
   - `packages/api/`: tRPC procedures, verify authorization builders (`wsPermissionProcedure`, `wsReadPermissionProcedure`, `memberReadProcedure`, `selfProcedure`, `publicHealthProcedure`), `meta.authz` enforcement, bypass risks.
   - `packages/validators/`: Role and permission matrix (`ctx.workspace.role`), privilege escalation risks, checking if roles are ever mistakenly inferred from `user_metadata` or client state.
2. **Database Security & RLS**:
   - `packages/db/`: Drizzle schema, RLS policies, migrations, Supabase database access patterns, SQL injection vectors, multi-tenant isolation (workspace tenant leakage risks).
3. **Attack Surfaces & Secret Management**:
   - Environment variables handling (`apps/erp/src/env.ts`), service role key exposure risks (`SUPABASE_SERVICE_ROLE_KEY`), public endpoints, SSR vs client boundary leaks.
4. **Scalability Bottlenecks**:
   - Architecture review: Next.js 16 App Router SSR performance under load, database connection pooling limits in serverless/Vercel environments, lack of caching, query amplification (N+1), background job processing / asynchronous queue limitations.
5. **Severity Classification**:
   - Classify all findings by severity: Critical, High, Medium, Low, Informational.
6. **Deliverable**:
   - Write comprehensive report to `report.md` in your working directory and deliver a complete `handoff.md`.
   - DO NOT modify any code.

## 2026-10-30T23:10:49Z

[Message] timestamp=2026-10-30T23:10:49Z sender=22137723-b5bb-491b-a106-88e732dbffe5 priority=MESSAGE_PRIORITY_HIGH content=You are the Security & Scalability Auditor (explorer_security_r1).
Working directory: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\explorer_security_r1\
Original request: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\ORIGINAL_REQUEST.md
Global project scope: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\PROJECT.md
Your dispatch instructions: c:\Users\jzs99\Desktop\TEST\.agents\teamwork\explorer_security_r1\DISPATCH.md

CRITICAL HARD CONSTRAINTS:

1. READ ONLY. DO NOT MODIFY ANY APPLICATION CODE OR CONFIGURATION FILES.
2. Read ORIGINAL_REQUEST.md and DISPATCH.md thoroughly before starting.

TASK:
Perform a critical, professional security and scalability audit of the Cendaro ERP codebase:

1. Authentication & Authorization:
   - Audit `packages/auth/`, `packages/api/` (all tRPC procedures and routers), `packages/validators/`.
   - Verify compliance with the role/permission matrix: are permissions strictly checked via `ctx.workspace.role`? Are roles ever improperly inferred from `user_metadata` or client data?
   - Verify every tRPC procedure uses the required authz builders (`wsPermissionProcedure`, `wsReadPermissionProcedure`, `memberReadProcedure`, `selfProcedure`, `publicHealthProcedure`) and records `meta.authz`.
   - Check session handling, cookie security (SameSite, HttpOnly, Secure flags in SSR), token refresh, and cross-site vulnerabilities.
2. Database Security & Tenant Isolation:
   - Audit `packages/db/` (schema, migrations, client) and Supabase RLS policies.
   - Investigate multi-tenant isolation: can workspace A ever access or mutate records belonging to workspace B? Check all Drizzle queries for missing `where(eq(..., workspaceId))` filters or flawed RLS.
   - Check SQL injection vectors, raw SQL queries, or bypass vulnerabilities.
3. Secrets, Config & Attack Surface:
   - Review `apps/erp/src/env.ts` and secret handling: ensure `SUPABASE_SERVICE_ROLE_KEY` is never leaked to the client bundle or public routes.
   - Audit public API routes, webhook handlers, and health checks.
4. Scalability Bottlenecks:
   - Assess Next.js 16 App Router serverless execution on Vercel: cold start latency, connection pool starvation with Supabase (direct vs Supavisor pooler), lack of distributed caching (Redis/Upstash/React cache), N+1 query loops in tRPC routers, background job execution constraints (long-running POS sync, mass price updates, inventory recalculation).
5. Output Deliverables:
   - Document all findings in `c:\Users\jzs99\Desktop\TEST\.agents\teamwork\explorer_security_r1\report.md` with:
     - Executive summary
     - Vulnerability inventory with Severity (Critical, High, Medium, Low, Informative), affected files, proof-of-concept / code snippet, and remediation recommendations.
     - Scalability bottleneck catalog with architectural impacts and concrete solutions.
   - Deliver `handoff.md` and send a completion message back to the orchestrator.
