---
name: create-plan
description: >
  Create a new plan document in the canonical .opencode/plans/ directory.
  Use when the user says "create a plan", "write a plan for", "plan this",
  "implementation plan", or "design document".
disable-model-invocation: true
argument-hint: "[SCOPE] [SUBJECT]"
arguments: [scope, subject]
allowed-tools: Write, Read
---

# Create Plan — `.opencode/plans/`

Create a new plan at `.opencode/plans/PLAN-$scope-$subject.md`

## Template

```markdown
# PLAN-$scope-$subject

> **Created**: [current date]
> **Status**: 📋 Pending
> **Author**: Codex

## Background

[Brief description of the problem and what this plan addresses]

## Proposed Changes

### [Component 1]

- [ ] Change description

### [Component 2]

- [ ] Change description

## Open Questions

- [ ] Question 1
- [ ] Question 2

## Verification Plan

- [ ] How to verify the changes work
```

## Valid Scopes

| Scope       | When to use                |
| :---------- | :------------------------- |
| `MAESTRO`   | Large multi-phase plans    |
| `FEATURE`   | New feature implementation |
| `DB`        | Database migrations/schema |
| `SECURITY`  | Security hardening         |
| `REFACTOR`  | Code cleanup               |
| `MARKETING` | Marketing strategy         |
| `PERF`      | Performance optimization   |
| `INFRA`     | Infrastructure/deployment  |

## Rules

- **NEVER** save plans to project root, `/docs/`, or `/tmp/`
- For major revisions, append version: `-V2.md`, `-V3.md`
- Never overwrite existing plans
