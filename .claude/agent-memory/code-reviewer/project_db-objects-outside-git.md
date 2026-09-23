---
name: db-objects-outside-git
description: Cendaro prod DB triggers/functions (validate_stock_quantity, record_price_change, trg_ar_payment, generate_order_number) and app_user grants are NOT defined in packages/db/migrations
metadata:
  type: project
---

Production-only DB objects exist that no migration file defines: trigger functions `validate_stock_quantity`, `record_price_change`, `generate_order_number`, `update_ar_on_payment` (trigger `trg_ar_payment`), and the `app_user` role's table-level grants. They are only named in migration 005 (REVOKE list) and `.opencode/reports/SECURITY-REPORT-*`.

**Why:** Reviews of SQL migrations can't verify trigger timing (INSERT vs INSERT OR UPDATE) or attached tables from the repo; in 2026-09 two of these triggers were found broken in prod (every payment / stock_movement insert failed), hidden by swallowed client errors.

**How to apply:** When a change starts writing to a table for the first time (payment, stock_movement, sales_order...), flag that the caller must read `pg_get_triggerdef` / `pg_get_functiondef` for that table before deploy; don't assume triggers are INSERT-only. See [[ui-authz-drift]].
