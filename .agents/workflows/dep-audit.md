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
  "next", "react", "react-dom",
  "@supabase/ssr", "@supabase/supabase-js",
  "@trpc/client", "@trpc/server", "@trpc/tanstack-react-query",
  "@tanstack/react-query", "superjson",
  "drizzle-orm", "drizzle-zod", "drizzle-kit", "postgres",
  "zod", "@t3-oss/env-nextjs",
  "tailwindcss", "@tailwindcss/postcss",
  "class-variance-authority", "clsx", "tailwind-merge",
  "radix-ui", "sonner",
  "typescript", "@types/node",
  "eslint", "@eslint/js", "prettier",
  "eslint-plugin-react", "eslint-plugin-react-hooks",
  "eslint-plugin-turbo", "typescript-eslint",
  "turbo", "@turbo/gen", "dotenv-cli"
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

```bash
Remove-Item -Recurse -Force node_modules, pnpm-lock.yaml
pnpm install
pnpm build
pnpm typecheck
```

### 6. Update README.md stack table

Update the version numbers in the Stack Tecnológico table.

### 7. Add date comment to pnpm-workspace.yaml

Add a comment like `# DEPENDENCY CATALOG — Stabilized YYYY-MM-DD` for traceability.
