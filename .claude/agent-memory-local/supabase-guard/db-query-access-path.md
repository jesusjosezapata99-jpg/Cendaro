---
name: db-query-access-path
description: How to actually run read-only SQL as supabase-guard on this machine — no Supabase MCP tools are exposed to this subagent; use DATABASE_URL + postgres.js
metadata:
  type: reference
---

The `supabase-guard` subagent is **not** given the Supabase MCP tools at runtime (only Read/Bash/Write/Edit), despite CLAUDE.md listing `supabase` as an MCP. To run read-only SQL, connect directly.

**Why:** MCP servers are allow-listed for the main session, not propagated into this subagent's tool set. Discovered 2026-09-12 when asked to run three role-inspection queries.

**How to apply:**

- Credentials: `DATABASE_URL` in `C:\Users\jzs99\Desktop\TEST\.env` — Supabase pooler at `aws-1-eu-west-3.pooler.supabase.com:5432`, user `postgres.ljwoptpaxazqmnhdczsb`. Always assert the string contains `ljwoptpaxazqmnhdczsb` before connecting (never `xlgyogcaflsmmwpcuiwk`).
- `psql` is NOT installed. Driver is `postgres` (postgres.js v3) but only via pnpm's virtual store — a script in the scratchpad cannot resolve `import postgres from "postgres"`. Import the resolved path as a `file:///` URL (Windows bare `C:/` paths fail with `ERR_UNSUPPORTED_ESM_URL_SCHEME`). Get the path with `node -e "console.log(require.resolve('postgres'))"` run from `packages/db`.
- Use `postgres(url, { max: 1, prepare: false, ssl: "require" })` and `sql.unsafe(q)` for literal query text; wrap each query to print `e.code` / `e.severity` verbatim.
- Keep the script in the scratchpad, not the project tree.
- This path is gated: the auto-mode permission classifier denies repeat runs as **[Production Reads]**. Expect to get one batch through, then need explicit user approval. Do not try to route around the denial — surface it and let the user decide.
