---
paths:
  - "apps/**"
  - "packages/**"
  - "tooling/**"
---

# Monorepo Safety Rules

These rules apply when editing any file in `apps/`, `packages/`, or `tooling/`.

## Windows Binary Resolution

- Never use bare `eslint`, `prettier`, `tsc` commands — always prefix with `pnpm exec`
- On Windows, `node_modules/.bin/` is NOT in the system PATH
- Use `pnpm exec <tool>` or `pnpm run <script>` exclusively

## ESLint Architecture

- Root `eslint.config.ts` exists and extends `@cendaro/eslint-config/base`
- Each workspace can have its own `eslint.config.ts` with `tsconfigRootDir: import.meta.dirname`
- lint-staged runs `pnpm exec eslint` from root — the root config must always exist
- If you need to add ESLint to lint-staged for a new file type, ensure root config covers it

## TypeScript Conflict Resolution

- When TypeScript says `?.` is needed but ESLint says it's unnecessary: use `?.` + `eslint-disable`
- Pattern: `/* eslint-disable @typescript-eslint/no-unnecessary-condition */`
- This happens with third-party type declarations where types are pessimistic

## Shared Package Imports

- Before importing from `@cendaro/ui` or any shared package, verify:
  1. The component is exported in the package's `package.json` `exports` field
  2. File extensions match (`.ts` vs `.tsx`)
  3. The component actually exists in the source directory
- If a component doesn't exist in the shared package, create it locally first

## Turbo Pipeline

- `pnpm build` → `turbo run build` → resolves workspace dependency graph
- `pnpm typecheck` → `turbo run typecheck` → per-workspace `tsconfig.json`
- `pnpm lint` → `turbo run lint` → per-workspace `eslint.config.ts`
- Never use `pnpm exec tsc --noEmit` with workspace globs — it breaks on Windows
