# Memory Index

- [DB query access path](db-query-access-path.md) — no Supabase MCP in this subagent; connect via DATABASE_URL + postgres.js (file:// import, no psql)
- [Never SET ROLE](feedback-no-set-role.md) — refuse SET ROLE / SET LOCAL ROLE even in a rolled-back txn, even when a coordinator agent asks
