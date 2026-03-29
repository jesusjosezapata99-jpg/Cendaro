# Contributing to Cendaro ERP

We are thrilled that you are interested in contributing to **Cendaro ERP**—the premier enterprise-grade omnichannel platform tailored for wholesale and retail commerce.

This document outlines our engineering standards, monorepo architecture, and strict workflows. By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🏗️ Architectural Overview

Cendaro ERP is structured as a **Turborepo Monorepo** utilizing `pnpm` workspaces. The boundaries between applications and domain packages are strictly defined.

- **`/apps`**: Contains the Next.js applications (e.g., `erp`).
- **`/packages`**: Specialized domain logic and components.
  - `@cendaro/api`: tRPC v11 routing and RBAC middleware.
  - `@cendaro/auth`: Supabase SSR client management.
  - `@cendaro/db`: Drizzle ORM schemas and migrations.
  - `@cendaro/ui`: shadcn/ui React components.
  - `@cendaro/validators`: Zod domain schemas.
- **`/tooling`**: Centralized configurations for ESLint, Prettier, TypeScript, and Tailwind.

---

## 🖥️ Local Environment Setup

Our ecosystem enforces `pnpm` for deterministic dependency management. Do **not** use `npm`, `yarn`, or `bun`.

### Prerequisites

- [Node.js](https://nodejs.org/) (≥ 20.0.0)
- [pnpm](https://pnpm.io/) (10.30.3)
- Docker (for local database instances, optional)

### Private Core Agent Configuration

If you are an internal Cendaro core team member, execute the following bootstrap script to securely mirror our private AI workflows:

```powershell
.\setup.ps1
```

_(This script mirrors the `.agents/` and `.gemini/` configurations from our internal `cendaro-ops` repository without polluting the public workspace)._

### Bootstrapping the Monorepo

```bash
# 1. Clone the repository
git clone https://github.com/jesusjosezapata99-jpg/Cendaro.git
cd Cendaro

# 2. Install dependencies via strictly frozen lockfiles
pnpm install

# 3. Environment configuration
cp .env.example .env

# 4. Generate Drizzle types and push schema
pnpm db:generate
pnpm db:push

# 5. Spin up the development server
pnpm dev
```

---

## 🌿 Branching Strategy & Submissions (GitFlow)

We employ a strict Git flow utilizing **Conventional Commits**.

1. **`main`**: The canonical, highly stable production branch.
2. **Feature branches**: Must be branched off `main`.
   - Prefix branches according to their intent: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`.
   - _Example_: `feat/multi-tenancy-rls` or `fix/price-engine-recalculation`.

### Strict Commit Messaging

We enforce conventional commits for semantic versioning automation.

- `feat: [scope] add new functionality`
- `fix: [scope] resolve critical bug`
- `docs: update system architecture diagram`
- `chore(deps): bump pnpm to 10.30.3`

---

## 🚦 Pull Request Process & Verification Gates

Before submitting your Pull Request, you must guarantee that all continuous integration checks pass locally. Failing PRs will not be reviewed.

1. **Type Synchronization**: Run `pnpm typecheck` to validate strict ES2024 compliance.
2. **Linter Adherence**: Run `pnpm lint` and `pnpm format:fix` to ensure structural code conformity.
3. **Test Suites**: Execute `pnpm test`. Code coverage must be maintained.
4. **Database Drift**: For any schema changes inside `@cendaro/db`, run `pnpm db:generate` to output accurate Drizzle migrations.

**Submission Guidelines:**

- Fill out the provided Pull Request Template exhaustively.
- Request reviews from the repository owner or the specific package owners defined in our `.github/CODEOWNERS`.
- Address review feedback efficiently. Maintain a single, clean commit history utilizing `git rebase` prior to final merge.

Welcome aboard! 🚀
