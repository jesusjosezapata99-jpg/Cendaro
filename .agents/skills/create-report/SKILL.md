---
name: create-report
description: >
  Create a new report document in the canonical .opencode/reports/ directory.
  Use when the user says "create a report", "write a report", "audit report",
  "research report", "test report", or "incident report".
disable-model-invocation: true
argument-hint: "[CATEGORY] [SUBJECT]"
arguments: [category, subject]
allowed-tools: Write, Read
---

# Create Report — `.opencode/reports/`

Create a new report at `.opencode/reports/$category-REPORT-$subject.md`

## Template

```markdown
# $category-REPORT-$subject

> **Date**: [current date]
> **Author**: Codex
> **Type**: $category

## Executive Summary

[2-3 sentence summary of findings]

## Findings

### Finding 1

- **Severity**: 🔴 Critical / 🟡 High / 🟢 Medium / ℹ️ Info
- **Description**: [what was found]
- **Impact**: [business/technical impact]
- **Recommendation**: [what to do]

## Conclusion

[Overall assessment and next steps]
```

## Valid Categories

| Category    | When to use                            | Example                               |
| :---------- | :------------------------------------- | :------------------------------------ |
| `AUDIT`     | Code, security, performance, UX audits | `AUDIT-REPORT-SECURITY-OWASP.md`      |
| `RESEARCH`  | Market research, competitor analysis   | `RESEARCH-REPORT-PROSPECTS-MADRID.md` |
| `TEST`      | Test results, QA reports               | `TEST-REPORT-E2E-CHECKOUT.md`         |
| `INCIDENT`  | Post-mortems, bug reports              | `INCIDENT-REPORT-STRIPE-WEBHOOK.md`   |
| `ANALYTICS` | Metrics, KPI summaries                 | `ANALYTICS-REPORT-CONVERSION-Q2.md`   |
| `REVIEW`    | Code reviews, architecture reviews     | `REVIEW-REPORT-GRAPHIFY-AUDIT.md`     |

## Rules

- **NEVER** save reports to project root, `/docs/`, or `/tmp/`
- Reports are read-only after creation — create new files for follow-ups
- Mark findings with severity levels
- Always include date and author
