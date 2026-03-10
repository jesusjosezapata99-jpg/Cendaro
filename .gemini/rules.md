## Cendaro Monorepo — Mandatory Agent Rules

> **SYNC**: Claude Code reads `.claude/CLAUDE.md`. Both agents share `.agents/skills/omni-epistemic-memory/error-log.md` as the single source of truth for error history.

### Pre-Flight Protocol (every code change)

1. Read the `omni-epistemic-memory` skill at `.agents/skills/omni-epistemic-memory/SKILL.md`.
2. Read the Error Log at `.agents/skills/omni-epistemic-memory/error-log.md` — check the Quick Reference table for matching patterns.
3. Read the relevant KI from the OmniCore ERP Technical Handbook before touching architecture.

### Validation Protocol

4. Always verify changes with `pnpm lint`, `pnpm typecheck`, `pnpm build`. Exit Code 0 = truth.
5. Never use bare `eslint` or `prettier` — always `pnpm exec` prefix.

### Safety Protocol

6. Supabase project ID = `ljwoptpaxazqmnhdczsb` (Cendaro). Block `xlgyogcaflsmmwpcuiwk` (Svartx). Follow `/supabase-safety`.

### Change Management

7. Dependency changes → `/dep-audit` → `/memory-audit`.
8. Critical changes (schema, architecture, security, new pages, API) → `/prd-sync`.

### Environment

9. Windows PowerShell only — no bash/Unix syntax.

### Evolutionary Learning

10. **After fixing ANY bug**, append the lesson to `.agents/skills/omni-epistemic-memory/error-log.md` following the template format. Include: Error, Root Cause, Fix, Prevention Rule, Workspace.
11. **Every error makes the system stronger** — but ONLY if documented. Undocumented fixes are lost knowledge.
12. **Before starting work**, always check if a similar error was already solved by reading the error log.
