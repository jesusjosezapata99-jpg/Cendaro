---
paths:
  - "packages/db/**"
  - "packages/auth/**"
---

# Supabase Operations Safety

These rules apply when editing database schemas, queries, migrations, or authentication code.

## Project Identification

| Project              | ID                     | Status            |
| -------------------- | ---------------------- | ----------------- |
| **Cendaro** (target) | `ljwoptpaxazqmnhdczsb` | ✅ Safe to modify |
| **Svartx** (blocked) | `xlgyogcaflsmmwpcuiwk` | 🚫 NEVER touch    |

## Before Any DB Operation

1. Confirm you are targeting project `ljwoptpaxazqmnhdczsb`
2. If using MCP Supabase tools, pass `project_id: "ljwoptpaxazqmnhdczsb"` explicitly
3. Never run destructive operations without user confirmation

## Migration Rules

- Name migrations in `snake_case` with descriptive names
- Always include `IF NOT EXISTS` for table creation
- Always include `IF EXISTS` for table drops
- Never drop columns in production without a migration plan
- Test migrations locally before pushing

## RLS (Row Level Security)

- Every new table MUST have RLS enabled
- Every table MUST have at least one RLS policy
- Run security advisors after DDL changes: use `get_advisors` with type "security"

## Drizzle ORM

- Schema changes go in `packages/db/src/schema/`
- Always export inferred types for tRPC consumption in `@cendaro/api`
- Run `pnpm -F @cendaro/db generate` after schema changes
