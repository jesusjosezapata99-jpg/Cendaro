---
paths:
  - "packages/db/**"
  - "**/*.sql"
---

# Database schema, migrations and RLS

## Schema

- Tables live in `packages/db/src/schema.ts`. Export `$inferSelect` / `$inferInsert` types for tRPC, and bridge to Zod with `createInsertSchema()` / `createSelectSchema()` from `drizzle-zod`.
- Every foreign key gets an index in the same table callback: `index("idx_<table>_<column>")`. Postgres never indexes FKs by itself. Guarded by `fk-index-coverage.test.ts`.
- `getDb()` builds the client with `casing: "snake_case"`; database columns are snake_case.

## Migrations

- Migrations are hand-written, numbered SQL files in `packages/db/migrations/` (`NNN_name.sql`), each with a matching `NNN_name.rollback.sql`.
- They reach production only as an approved write (see AGENTS.md and the `supabase-write` skill). Never use `pnpm db:push` against production.

## RLS and functions

- Every `app_user` policy on a table with tenant data is scoped by `(select current_setting('app.workspace_id', true))::uuid`, or by workspace membership. Keep the cast outside the subquery so Postgres evaluates it once, not per row. Only the global catalogs `permission` and `role_permission` may use `USING (true)`. Guarded by `rls-coverage.test.ts` and the structural audit in `integration.workspace-rls.test.ts`.
- A new `SECURITY DEFINER` function is callable through `/rest/v1/rpc` by default. In the same migration add `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated`.
- Extensions live in schema `extensions`, where `app_user` needs `USAGE` (granted in migration 008). Check which roles call an extension before moving it; a missing grant shows up as `function … does not exist` only for `app_user`.
