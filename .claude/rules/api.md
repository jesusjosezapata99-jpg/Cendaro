---
paths:
  - "packages/api/**"
  - "packages/validators/**"
  - "packages/auth/**"
  - "apps/erp/src/app/api/**"
  - "apps/erp/src/trpc/**"
---

# API, tRPC and queries

## Procedures

- Business logic lives in `packages/api/src/modules/`. Validate input with Zod schemas from `@cendaro/validators` (shared schemas belong there).
- Authorization comes from the builder (see AGENTS.md), never from a check inside the procedure. Permissions are the `ROLE_PERMISSIONS` matrix in `@cendaro/validators` plus the workspace plan module; `roles-rbac.test.ts` exercises real calls per role.
- The tRPC context provides `db`, `session` and `user`; the session is validated by the middleware in `packages/auth`.
- Return mapped, typed objects, never raw Drizzle rows.
- Explicit return types are required in `packages/api/`, `apps/erp/src/app/api/` and server actions. Every code path returns explicitly (no implicit `undefined`).
- Use discriminated unions for state machines and result types; prefer `as const` and `satisfies`.

```ts
export const catalogRouter = createTRPCRouter({
  list: wsReadPermissionProcedure("catalog", "read")
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // query through ctx.db, then map rows to the output shape
    }),
});
```

## Queries

- Prefer `ctx.db.select().from(table).where(...)` over raw SQL, and wrap multi-table writes in `db.transaction()`.
- Never use `sql.raw()` with interpolated values; parameterize through `sql` template placeholders.
- Raw SQL uses snake_case identifiers (`c.workspace_id`, never `c."workspaceId"`); quoted camelCase fails with `42703`. Guarded by `sql-identifiers.test.ts`.
- Avoid N+1 queries: use joins or batched selects.
- Read procedures run inside one RLS transaction on a single connection, so a `Promise.all` of queries is serialized (and `pg` warns it will stop allowing it in pg@9). Await sequentially, or accept the serialization knowingly; review these batches before upgrading `pg` to 9.
- A hand-built Drizzle client (for example in integration suites) must match `getDb()`: `drizzle(pool, { schema, casing: "snake_case" })`. Without `casing` it fails with `column "fullName" does not exist`.
