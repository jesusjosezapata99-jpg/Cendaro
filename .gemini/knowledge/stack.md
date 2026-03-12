# Cendaro ERP — Technology Stack Inventory

> Auto-generated from zero-trust repository audit. All versions are empirically verified from `package.json` and `pnpm-workspace.yaml` catalog entries.

---

## Core Stack

| Category            | Technology                 | Version  | Usage in this project                               |
| ------------------- | -------------------------- | -------- | --------------------------------------------------- |
| **Framework**       | Next.js                    | ^16.0.10 | App Router, Server Components, Turbopack dev server |
| **UI Library**      | React                      | 19.1.4   | Server + Client Components                          |
| **UI Library**      | React DOM                  | 19.1.4   | DOM rendering                                       |
| **Styling**         | Tailwind CSS               | ^4.2.1   | Utility-first CSS via PostCSS plugin                |
| **Styling**         | @tailwindcss/postcss       | ^4.2.1   | Tailwind v4 PostCSS integration                     |
| **Database ORM**    | Drizzle ORM                | ^0.45.1  | Type-safe SQL queries, schema definitions           |
| **Database ORM**    | drizzle-zod                | ^0.8.3   | Drizzle ↔ Zod schema bridge                         |
| **Database ORM**    | Drizzle Kit                | ^0.31.9  | Schema push, migration generation, Studio           |
| **Database Driver** | postgres (pg.js)           | ^3.4.8   | PostgreSQL wire protocol driver                     |
| **Auth**            | @supabase/supabase-js      | ^2.98.0  | Supabase client SDK for auth + queries              |
| **Auth**            | @supabase/ssr              | ^0.6.1   | Server-side auth with cookie management             |
| **API**             | @trpc/server               | ^11.12.0 | Type-safe API routers + procedures                  |
| **API**             | @trpc/client               | ^11.12.0 | Client-side tRPC caller                             |
| **API**             | @trpc/tanstack-react-query | ^11.12.0 | tRPC + TanStack Query integration                   |
| **State/Fetching**  | @tanstack/react-query      | ^5.90.21 | Server state management, caching, refetching        |
| **Virtualization**  | @tanstack/react-virtual    | ^3.13.21 | Virtual scrolling for large lists/tables            |
| **Validation**      | Zod                        | ^4.3.6   | Schema validation (import from `zod/v4`)            |
| **Serialization**   | superjson                  | 2.2.6    | tRPC data transformer (Date, BigInt, etc.)          |
| **Env Validation**  | @t3-oss/env-nextjs         | ^0.13.10 | Type-safe env vars with Zod validation              |

## UI Components

| Category              | Technology                     | Version | Usage in this project                          |
| --------------------- | ------------------------------ | ------- | ---------------------------------------------- |
| **Component Library** | Radix UI                       | ^1.4.3  | Headless accessible primitives (via shadcn/ui) |
| **Component Library** | @radix-ui/react-icons          | ^1.3.2  | Icon set for UI components                     |
| **Variants**          | class-variance-authority (CVA) | ^0.7.1  | Component variant composition                  |
| **CSS Utilities**     | clsx                           | ^2.1.1  | Conditional class name joining                 |
| **CSS Utilities**     | tailwind-merge                 | ^3.5.0  | Tailwind class deduplication/merging           |
| **Toasts**            | Sonner                         | ^2.0.7  | Toast notification system                      |
| **Animations**        | tw-animate-css                 | ^1.4.0  | Tailwind CSS animation utilities               |
| **Theming**           | next-themes                    | ^0.4.6  | Dark/light mode theme switching                |

## File Processing

| Category             | Technology     | Version | Usage in this project                        |
| -------------------- | -------------- | ------- | -------------------------------------------- |
| **Spreadsheets**     | xlsx (SheetJS) | ^0.18.5 | Excel/CSV file parsing and generation        |
| **PDF**              | pdf-parse      | ^2.4.5  | PDF text extraction                          |
| **Zip**              | jszip          | ^3.10.1 | ZIP archive creation/extraction              |
| **Image Processing** | sharp          | ^0.34.5 | Image optimization (server external package) |

## Testing

| Category             | Technology | Version | Usage in this project                  |
| -------------------- | ---------- | ------- | -------------------------------------- |
| **Unit/Integration** | Vitest     | ^4.0.18 | Test runner for `@cendaro/api` package |

## Tooling

| Category            | Technology                          | Version | Usage in this project                                  |
| ------------------- | ----------------------------------- | ------- | ------------------------------------------------------ |
| **Monorepo**        | Turborepo                           | ^2.8.14 | Task orchestration, dependency graph, remote caching   |
| **Monorepo**        | @turbo/gen                          | ^2.8.14 | Turbo generators for scaffolding                       |
| **Package Manager** | pnpm                                | 10.30.3 | Workspace management, catalog versions                 |
| **Language**        | TypeScript                          | ^5.9.3  | Strict mode, ES2024 target, Bundler resolution         |
| **Linting**         | ESLint                              | ^9.39.4 | Flat config, per-workspace configs                     |
| **Linting**         | typescript-eslint                   | ^8.56.1 | TS-aware ESLint rules                                  |
| **Linting**         | @next/eslint-plugin-next            | ^16.1.0 | Next.js-specific lint rules                            |
| **Linting**         | eslint-plugin-react                 | ^7.37.5 | React-specific lint rules                              |
| **Linting**         | eslint-plugin-react-hooks           | ^5.2.0  | Hooks rules of React                                   |
| **Linting**         | eslint-plugin-import                | ^2.32.0 | Import ordering and validation                         |
| **Linting**         | @eslint/js                          | ^9.27.0 | ESLint core JS rules                                   |
| **Linting**         | @eslint/compat                      | ^1.3.1  | Legacy ESLint plugin compatibility                     |
| **Formatting**      | Prettier                            | ^3.8.1  | Code formatting                                        |
| **Formatting**      | @ianvs/prettier-plugin-sort-imports | ^4.7.1  | Import sorting                                         |
| **Formatting**      | prettier-plugin-tailwindcss         | ^0.6.12 | Tailwind class sorting                                 |
| **Git Hooks**       | Husky                               | ^9.1.7  | pre-commit (lint-staged), pre-push (typecheck + build) |
| **Git Hooks**       | lint-staged                         | ^16.1.0 | Run linters on staged files only                       |
| **Env**             | dotenv-cli                          | ^10.0.0 | Load `.env` for CLI commands (db:push, dev)            |
| **Build**           | jiti                                | ^2.6.1  | TypeScript config file execution (eslint.config.ts)    |

## Infrastructure

| Category           | Technology          | Version | Usage in this project                        |
| ------------------ | ------------------- | ------- | -------------------------------------------- |
| **Hosting**        | Vercel              | —       | Next.js deployment, serverless functions     |
| **Database**       | Supabase PostgreSQL | —       | Primary database with RLS                    |
| **Auth Provider**  | Supabase Auth       | —       | Email/password authentication, SSR sessions  |
| **Error Tracking** | Sentry              | —       | Production error monitoring (optional)       |
| **AI/LLM**         | Groq                | —       | LLM inference (optional)                     |
| **Exchange Rates** | Frankfurter API     | —       | Primary USD/CNY rate source (ECB data, free) |
| **Exchange Rates** | ExchangeRate-API    | —       | Fallback USD/CNY rate source (optional key)  |
| **Marketplace**    | MercadoLibre API    | —       | Marketplace integration (Phase 5, future)    |
| **Payments**       | Stripe (MCP)        | —       | Payment processing (via MCP server)          |
| **CI/CD**          | GitHub Actions      | —       | Automated typecheck → lint → build → test    |

---

> **Rule**: If a technology is NOT listed in this table, it does NOT exist in this project. Never reference, import, or install unlisted technologies without explicit user approval.
