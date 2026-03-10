---
description: PRD verification and documentation sync workflow — ensures README and PRD stay synchronized on critical changes
---

# PRD Sync & Verification Workflow

This workflow ensures that critical changes to the Cendaro project are verified against the PRD and that documentation stays synchronized.

## Document Locations

| Document   | Path                       | Purpose                                                                         |
| ---------- | -------------------------- | ------------------------------------------------------------------------------- |
| **PRD**    | `PRD.md` (project root)    | Product Requirements Document — source of truth for features and business rules |
| **README** | `README.md` (project root) | Technical reference — architecture, stack, pages, scripts                       |

> **IMPORTANT**: The ONLY PRD for this project is `PRD.md` at the project root. No other PRD files should exist anywhere in the repository.

## When to Trigger

This workflow MUST be executed when making any of the following **critical changes**:

1. **Schema changes** — New tables, columns, enums, or modifications to existing DB schema
2. **New module/router** — Adding a new tRPC router or domain module
3. **Architecture changes** — Modifying the package structure, adding new packages, or changing dependency relationships
4. **Security changes** — RBAC roles, RLS policies, auth flow modifications
5. **New page/route** — Adding a new page to the ERP app
6. **Dependency changes** — Adding or upgrading a major dependency
7. **API contract changes** — New or modified tRPC procedures that affect the public API
8. **Business rule changes** — Pricing logic, inventory rules, payment flows, document generation

## Steps

### 1. Read PRD

// turbo
Read `PRD.md` at the project root and verify the proposed change is consistent with the product requirements. Check:

- Does the change align with the PRD section for this module?
- Are there any PRD constraints that the change might violate?
- Is the change covered by the PRD, or is it an extension that needs business input?

If the change contradicts the PRD, **stop and notify the user** before proceeding.

### 2. Read README

// turbo
Read `README.md` at the project root and understand the current project structure, pages map, and architecture.

### 3. Execute the Change

Proceed with the implementation as planned.

### 4. Update PRD.md

// turbo
After the change is complete, update `PRD.md` to reflect:

- **New features** — if a new module or capability was added
- **Schema changes** — if database tables or columns were modified
- **Business rules** — if pricing, inventory, or payment logic changed
- **Phase progress** — if implementation milestones were reached

### 5. Update README.md

// turbo
After the change is complete, update `README.md` to reflect:

- **Stack table** — if dependency versions changed
- **Pages table** — if new pages were added (update status from 🔲 to ✅)
- **Package descriptions** — if package capabilities changed
- **Architecture diagram** — if package structure changed
- **Roadmap** — if phase status changed
- **Security model** — if auth/RBAC changed
- **Environment variables** — if new env vars were added

### 6. Verify Build

// turbo
Run the following to ensure nothing is broken:

```powershell
pnpm build
pnpm typecheck
```

## Critical Change Checklist

Before committing any critical change, verify all items:

- [ ] Change verified against `PRD.md`
- [ ] `README.md` checked for current state
- [ ] `PRD.md` updated with new changes (if applicable)
- [ ] `README.md` updated (if applicable)
- [ ] Build passes
- [ ] Typecheck passes
