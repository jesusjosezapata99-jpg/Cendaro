---
name: fake-db-test-gaps
description: Cendaro API authz tests use hand-rolled fake Drizzle DBs that match on SQL text only; check whether params/filters are actually asserted
metadata:
  type: project
---

API tests under `packages/api/src/__tests__/` (users-update-authz, workspace-membership, ...) build fake DBs that route `select` by table name and `where` SQL text rendered with a casing-less `PgDialect`. They never inspect bound params and ignore most filters, so swapping enum values (e.g. counting `["active"]` instead of `["active","invited"]`) or dropping a `role = owner` filter still passes. Transactions are `fn(base)`, so rollback is never exercised.

**Why:** Seen in the F3 security-remediation review (2026-09-17): the "counts pending invitations against maxUsers" test only checked `status in` in SQL text.

**How to apply:** When a review relies on these tests as proof of a security property, verify the assertion would fail if the implementation were wrong; suggest asserting `sqlToQuery(...).params`. Related: [[db-objects-outside-git]].
