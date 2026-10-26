---
name: supabase-write
description: Use before any write to the Cendaro Supabase production database (MCP execute_sql or apply_migration with INSERT, UPDATE, DELETE, DDL, RLS, functions or triggers), and when preparing a migration that will be applied there.
---

# Writing to the production database

Project `ljwoptpaxazqmnhdczsb` holds live customer data; every write is real and some cannot be undone.

## 1. Check the target

Confirm the project ID is `ljwoptpaxazqmnhdczsb` before any call. Stop if a tool or URL points at `xlgyogcaflsmmwpcuiwk` (a different product). For read-only investigation, prefer the `supabase-guard` subagent, which blocks SQL writes.

## 2. Classify the risk

| Risk     | Operations                                                 | Extra step                                             |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Critical | DDL (CREATE/ALTER/DROP), RLS policies, functions, triggers | Re-read the current definition, then ask a second time |
| High     | Inserts into auth tables, bulk UPDATE or DELETE            | Show a before/after diff of the affected rows          |
| Standard | SELECT and other read-only queries                         | No approval needed                                     |

## 3. Ask before writing

Send the user, in one message:

1. "I'm about to execute a WRITE operation via Supabase MCP."
2. What changes: the resource, the exact SQL or payload, and the current versus the new state.
3. Reversibility: reversible, partially reversible, or irreversible, and how to revert.
4. "¿Procedo con esta operación? (sí/no)"

Then stop and wait. Only an explicit yes for this specific operation counts; an approval given for an earlier operation does not carry over.

## 4. Migrations

- Write the change as `packages/db/migrations/NNN_name.sql` plus `NNN_name.rollback.sql`, following `.claude/rules/db.md` (scoped RLS, FK indexes, `REVOKE EXECUTE` on `SECURITY DEFINER` functions).
- Apply it with `apply_migration` only after approval, never with `pnpm db:push`.

## 5. Verify afterwards

Re-read what changed (`list_migrations`, `list_tables`, or a SELECT on the affected rows), run `get_advisors` for security and performance after DDL or RLS changes, and report the result with that evidence.

## If a write ran without approval

Tell the user immediately: what ran, the exact data written or changed, and the command that reverts it if one exists. Record it as a guardrail violation in the task's report under `plans/reports/`.
