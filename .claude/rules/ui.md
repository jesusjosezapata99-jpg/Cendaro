---
paths:
  - "apps/erp/src/**"
  - "packages/ui/**"
  - "tooling/tailwind/**"
---

# ERP UI (Next.js, React, design system)

## Structure

- `apps/erp/src/app/(app)/` holds the authenticated ERP pages, `app/api/` the route handlers and `login/` the public login. Shared layout pieces go in `components/`, hooks in `hooks/`, utilities in `lib/`, domain UI in `modules/`, and the tRPC client in `trpc/`.
- Route errors use the `error.tsx` convention.

## Components

- Use shadcn/ui components from `@cendaro/ui` (add new ones with `pnpm ui-add`), compose classes with `cn()`, and express variants with CVA.
- Action buttons that depend on permissions are wrapped in `<Can module action>` from `~/components/role-guard`.
- Themes go through `next-themes`; complex motion through `framer-motion`, not CSS transitions.
- Large tables use `@tanstack/react-virtual`. Heavy libraries (xlsx, pdf-parse, jszip) are loaded with dynamic imports. Images use Next.js `<Image>`.
- File uploads are parsed on the client and sent as chunked JSON; a raw file sent to a Vercel function fails with `FUNCTION_PAYLOAD_TOO_LARGE` (4.5 MB limit).

## Design system details

The core rules (radius, font weight, tokens, icons, status) are in AGENTS.md. In addition:

- When a color token is missing, add it to `tooling/tailwind/theme.css` first, then use it.
- Shadows only where `packages/ui/src` primitives already use them (`shadow-md` on dialog, sheet, dropdown and popover); no `shadow-*` in page code.
- `StatusBadge` is a deprecated compatibility wrapper; new code uses `StatusPill`.
- Before calling UI work done, run `node scripts/checks/design-guard.mjs --phase F9`.
