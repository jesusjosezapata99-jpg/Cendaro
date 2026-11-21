# Cendaro ERP — k6 Load & Supavisor Concurrency Suite

Validates Vercel Serverless + Supabase Supavisor (`:6543`, `max: 3` per instance, `statement_timeout = '5000ms'`) under concurrent read bursts and hotspot row-lock contention (`sales.checkoutPos`).

## Profiles

1. **`SMOKE`** _(default)_: 5 VUs for 30s executing 3-procedure tRPC batches (`dashboard.overview`, `catalog.listProducts`, `sales.listOrders`).
2. **`LOAD_250RPS`**: 3-minute sustained test at **250 req/s** (`10 RPS` `health.ping` + `200 RPS` batched authenticated reads + `40 RPS` `sales.checkoutPos` writes).
3. **`HOTSPOT_CONTEND`**: 50 concurrent VUs hammering a single `HOTSPOT_PRODUCT_ID` via `sales.checkoutPos` with 10% duplicate `idempotencyKey` replays, verifying `FOR UPDATE` row locking and `pg_advisory_xact_lock` idempotency.

## Usage (Staging / Preview Environment)

```powershell
k6 run `
  -e PROFILE=SMOKE `
  -e BASE_URL=https://preview-erp.example.com `
  -e WORKSPACE_ID=00000000-0000-4000-8000-000000000001 `
  -e SUPABASE_URL=https://<staging-ref>.supabase.co `
  -e SUPABASE_ANON_KEY=<staging-anon-key> `
  -e TEST_EMAIL=qa@example.com `
  -e TEST_PASSWORD=<staging-password> `
  scripts/load/erp-load-benchmark.k6.js
```

After `HOTSPOT_CONTEND`, always verify zero financial or stock drift:

```powershell
$env:PRODUCTION_MONITOR_URL = "<staging-monitor-url>"
node scripts/checks/prod/run-invariants.mjs
```
