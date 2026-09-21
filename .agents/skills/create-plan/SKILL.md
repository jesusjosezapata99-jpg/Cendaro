---
name: create-plan
description: >
  Create a new plan document in the canonical plans/ directory.
  Use when the user says "create a plan", "write a plan for", "plan this",
  "implementation plan", or "design document".
disable-model-invocation: true
argument-hint: "[SCOPE] [SUBJECT]"
arguments: [scope, subject]
allowed-tools: Write, Read
---

# Create Plan — `plans/`

Create a new plan at `plans/PLAN-$scope-$subject.md` (or `plans/PLAN-[YYYY-MM]-$scope-$subject.md`)

## Template

```markdown
# PLAN-$scope-$subject

> **ID**: PLAN-[YYYY-MM]-$scope-$subject  
> **Author**: [Claude Code | Antigravity | Codex | Human]  
> **Date**: [YYYY-MM-DD]  
> **Status**: 📋 Draft | 🟡 In Review | ⏳ In Progress | ✅ Completed | 🛑 Cancelled  
> **Scope / Modules**: `apps/erp`, `packages/api`, etc.  
> **Risk Level**: 🟢 Low | 🟡 Medium | 🔴 High (DDL / Prod DB)  
> **Reversibility**: ✅ Reversible | ⚠️ Partially Reversible | 🚫 Irreversible

---

## 1. Objective & Desired Outcome

[Brief description of the problem and single-sentence definition of success]

## 2. Hard Invariants & Guardrails

- ⛔ [Invariant 1]
- ⛔ [Invariant 2]

## 3. Implementation Phases

### Phase 1: [Phase Name]

- [ ] **[NEW]** [`path/to/file`](file:///...) — description
- [ ] **[MODIFY]** [`path/to/file`](file:///...) — description

### Phase 2: [Phase Name]

- [ ] ...

## 4. Open Questions

- [ ] Question 1

## 5. Binary Verification Plan

- **Typecheck**: `pnpm typecheck` (must exit 0)
- **Tests**: `pnpm test`
- **Lint**: `pnpm lint`

## 6. Rollback Strategy

[Reversion procedure in case of unexpected failure]
```

## Valid Scopes

| Scope       | When to use                |
| :---------- | :------------------------- |
| `MAESTRO`   | Large multi-phase plans    |
| `FEATURE`   | New feature implementation |
| `UI`        | Design system & interfaces |
| `DB`        | Database migrations/schema |
| `SECURITY`  | Security hardening         |
| `REFACTOR`  | Code cleanup               |
| `MARKETING` | Marketing strategy         |
| `PERF`      | Performance optimization   |
| `INFRA`     | Infrastructure/deployment  |
| `AUDIT`     | Deep technical audit       |

## Rules

- **NEVER** save plans to `.opencode/`, `~/.claude/plans/`, project root, `/docs/`, or `/tmp/`
- For major revisions, append version: `-V2.md`, `-V3.md`
- Never overwrite existing plans; reference previous versions when iterating
- Update the plan status to `✅ Completed` upon final verification
