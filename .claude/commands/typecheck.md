Run TypeScript type checking across all workspaces:

```bash
pnpm typecheck
```

This runs `turbo run typecheck` which executes `tsc --noEmit` in every workspace package.