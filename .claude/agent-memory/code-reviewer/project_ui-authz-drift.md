---
name: ui-authz-drift
description: Recurring review finding in Cendaro: client action buttons gated by hardcoded RoleGuard arrays (or not gated) drift from the server ROLE_PERMISSIONS matrix and produce 403s
metadata:
  type: project
---

When server authorization changes (e.g. SECURITY-REMEDIATION F2, 2026-09-17, which introduced `ROLE_PERMISSIONS`/`can()` in `@cendaro/validators`), the ERP UI tends to lag: many action buttons use `<RoleGuard allow={[...hardcoded]}>` or no guard at all, and only the nav (`NAV_ROLE_RULES`) is test-pinned to the matrix.

**Why:** In the F2 review, ungated "Nuevo Cliente/Producto/Marca/Categoría/Proveedor", the POS "+ Nuevo Cliente" button, the quick action "Nueva cotización" (all roles), and the container status buttons shown to supervisors all called procedures the role could no longer use. Also, universal plan-module gating broke starter-plan paths such as settings, users, and POS payments.

**How to apply:** For any authz or matrix change, grep `RoleGuard allow`, `set*Params({ create…: true })`, `mutate(` in `apps/erp/src`, and cross-check each against `can(role, module, action)` and the procedure's `meta.authz`. Also check plan-module rows (`STARTER_MODULES` in workspace.ts) for every module a basic flow touches.
