---
name: "source-command-typecheck"
description: "Migrated source command `typecheck`"
---

# source-command-typecheck

Use this skill when the user asks to run the migrated source command `typecheck`.

## Command Template

Run TypeScript type checking across all workspaces:

```bash
pnpm typecheck
```

This runs `turbo run typecheck` which executes `tsc --noEmit` in every workspace package.
