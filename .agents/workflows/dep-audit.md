---
description: How to update all monorepo dependencies to their latest stable versions
---

# Dependency Audit Workflow

// turbo-all

## When to Run

- Before starting a new major phase
- Monthly maintenance
- When security advisories are published
- After major framework releases (Next.js, React, Supabase)

## Steps

### 1. Query npm registry for all dependencies

Run this PowerShell script from the project root to get latest stable versions:

```powershell
$deps = @(
  # ── Frameworks ──
  "next", "react", "react-dom",
  # ── Supabase ──
  "@supabase/ssr", "@supabase/supabase-js",
  # ── tRPC ──
  "@trpc/client", "@trpc/server", "@trpc/tanstack-react-query",
  "@tanstack/react-query", "superjson",
  # ── Database ──
  "drizzle-orm", "drizzle-zod", "drizzle-kit", "postgres",
  # ── Validation & Env ──
  "zod", "@t3-oss/env-nextjs",
  # ── Styling ──
  "tailwindcss", "@tailwindcss/postcss",
  "class-variance-authority", "clsx", "tailwind-merge",
  "radix-ui", "next-themes", "sonner", "tw-animate-css",
  # ── TypeScript ──
  "typescript", "@types/node", "@types/react", "@types/react-dom",
  # ── Linting & Formatting ──
  "eslint", "@eslint/js", "@eslint/compat", "prettier",
  "eslint-plugin-react", "eslint-plugin-react-hooks",
  "eslint-plugin-import", "@next/eslint-plugin-next",
  "typescript-eslint",
  "@ianvs/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss",
  # ── Tooling ──
  "turbo", "@turbo/gen", "dotenv-cli",
  "husky", "lint-staged",
  # ── Utilities ──
  "jszip", "xlsx", "pdf-parse", "sharp",
  "@tanstack/react-virtual", "@radix-ui/react-icons",
  # ── Testing ──
  "vitest"
)
foreach ($d in $deps) {
  $v = npm view $d version 2>$null
  Write-Output "${d}: $v"
}
```

### 2. Review stability of each version

- Prefer versions released 2+ weeks ago
- For major version bumps (e.g. ESLint 9→10), check the changelog for breaking changes
- For `@types/*`, match the Node.js LTS version (currently Node 22)
- For React, stay on the `.1.x` release line unless `.2.x` is 30+ days old

### 3. Update pnpm-workspace.yaml catalog

All shared versions live in the `catalog:` section. Update there first.

### 4. Update individual package.json files

Update non-catalog dependencies in each package (e.g. drizzle-orm, postgres, superjson).

### 5. Clean install and verify

```powershell
Remove-Item -Recurse -Force node_modules, pnpm-lock.yaml
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

### 6. Update README.md stack table

Update the version numbers in the **Tech Stack** table in `README.md`.

### 7. Add date comment to pnpm-workspace.yaml

Add a comment like `# DEPENDENCY CATALOG — Stabilized YYYY-MM-DD` for traceability.

### 8. Run Memory Audit

After major dependency upgrades, run `/memory-audit` to prune KIs that reference deprecated or removed packages.

### 9. Run PRD Sync

Run `/prd-sync` to update `README.md` and `PRD.md` with any dependency or architecture changes.
