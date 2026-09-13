---
name: db-query-access-path
description: How supabase-guard runs read-only SQL — Supabase MCP tools are now exposed to this subagent; postgres.js via DATABASE_URL is the fallback
metadata:
  type: reference
---

As of 2026-09-13 the `supabase-guard` subagent **does** receive the Supabase MCP tools (`mcp__supabase__execute_sql`, `list_tables`, etc.). Use them first. (Before 2026-09-12 they were not propagated into the subagent — that has changed; do not assume the old limitation.)

**Why:** MCP allow-listing for subagents changed; verified by a successful `get_project_url` + `execute_sql` run.

**How to apply:**

- Always call `mcp__supabase__get_project_url` (or otherwise confirm `ljwoptpaxazqmnhdczsb`) before querying. Never `xlgyogcaflsmmwpcuiwk`.
- Fallback only if MCP tools are absent: `DATABASE_URL` in `C:\Users\jzs99\Desktop\TEST\.env` (pooler `aws-1-eu-west-3.pooler.supabase.com:5432`, user `postgres.ljwoptpaxazqmnhdczsb`). `psql` is NOT installed; use postgres.js resolved via `node -e "console.log(require.resolve('postgres'))"` from `packages/db`, imported as a `file:///` URL (bare `C:/` paths fail with `ERR_UNSUPPORTED_ESM_URL_SCHEME`). Options: `{ max: 1, prepare: false, ssl: "require" }`, query with `sql.unsafe(q)`. Keep scripts in the scratchpad.
- The fallback path is gated by the permission classifier as **[Production Reads]** — surface a denial to the user rather than routing around it. See [[feedback-no-set-role]].
