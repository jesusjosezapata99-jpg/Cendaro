---
name: coding-review
description: >
  Run pre-commit quality checks on the codebase. Use when the user says
  "review code", "pre-commit check", "quality check", "is the code ready",
  or before any git commit.
disable-model-invocation: true
allowed-tools: Bash(pnpm *), Read, Grep
---

# Pre-Commit Code Review

Run these checks **in order**. Stop and report at the first failure.

## 1. TypeScript Strict Check
```
pnpm typecheck
```
Must pass with **zero errors**.

## 2. ESLint
```
pnpm lint
```
Must pass with **zero warnings**.

## 3. Manual Checks

Scan all modified files (`git diff --name-only HEAD`) for:

- [ ] No `console.log` in production code (use structured logging)
- [ ] No hardcoded user-facing strings — all text must be in `lib/i18n/dictionaries/`
- [ ] All imports use `@/` alias — no `../../` climbing more than one level
- [ ] No default exports from `lib/` files
- [ ] API routes have: origin check + rate limit + Zod validation + typed response
- [ ] New Supabase operations: verified RLS allows or uses service role client

## 4. Report

Summarize results:
- ✅ Passed checks
- ❌ Failed checks with file:line references
- 📋 Recommendations
