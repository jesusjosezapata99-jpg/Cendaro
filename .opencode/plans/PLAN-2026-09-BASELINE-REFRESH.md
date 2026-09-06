# PLAN — Baseline Refresh 2026-09 (Cendaro ERP)

**Origen**: `.opencode/reports/AUDIT-REPORT-2026-09-BASELINE-REFRESH.md`
**Estrategia**: 6 fases secuenciales, cada una con **puerta de verificación** (typecheck → lint → build → test). Un commit por fase (solo con aprobación explícita del usuario). Rollback = `git checkout -- .` + `pnpm install` por fase.

---

## Fase 0 — Higiene de base (0 riesgo, ~10 min)

| #       | Acción                                                                                          | Comando/Archivo                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | Re-formatear todo el monorepo (137+ archivos)                                                   | `pnpm format:fix`                                                                                                            |
| 0.2     | Actualizar overrides raíz                                                                       | `package.json` → `tmp: ^0.2.6`, `brace-expansion: >=5.0.7`, **añadir** `postcss: >=8.5.12`, `lodash: ^4.18.0`, `ws: ^8.21.0` |
| 0.3     | Resolver huérfano `apps/web/`                                                                   | Mover `apps/web/public/cendaro-logo.png` → `apps/erp/public/` y eliminar `apps/web/`                                         |
| 0.4     | Corregir `metadataBase`                                                                         | `apps/erp/src/app/layout.tsx` → `metadata.metadataBase = new URL(env.NEXT_PUBLIC_SUPABASE_URL origin o VERCEL_URL)`          |
| ✅ Gate | `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde + `pnpm lint:ws` sin warnings |

## Fase 1 — Parches de seguridad de producción (prioridad máxima, ~30 min)

| #       | Paquete                                                                                                              | De → A              | Por qué                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| 1.1     | `next` (apps/erp)                                                                                                    | 16.1.7 → **16.3.4** | 7 advisories HIGH incl. **middleware bypass** (protege todo el ERP) |
| 1.2     | `drizzle-orm` (catalog)                                                                                              | 0.45.1 → 0.45.2     | **SQL injection** (GHSA-gpj5-g38j-94v9)                             |
| 1.3     | `drizzle-kit` (packages/db)                                                                                          | 0.31.9 → 0.31.10    | Alineación                                                          |
| 1.4     | `sharp` (apps/erp)                                                                                                   | 0.34.5 → 0.35.4     | 4 CVEs libvips                                                      |
| 1.5     | `@supabase/supabase-js` (3 workspaces)                                                                               | 2.100.1 → 2.114.0   | ws ≥8.21.0 + fixes                                                  |
| 1.6     | `@next/eslint-plugin-next` (tooling/eslint)                                                                          | 16.1.6 → 16.3.4     | Alineación con Next                                                 |
| ✅ Gate | Pipeline completo + `pnpm audit --prod` limpio + smoke test manual del login y del proxy (rutas públicas/protegidas) |

## Fase 2 — Parches de seguridad dev + minors estables (~45 min)

| #       | Acción                                                                                                                                                                                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1     | `vitest` (packages/api) 4.0.18 → **4.1.11** (crítico GHSA-5xrq + vite ≥7.3.5)                                                                                                                                                                                                                                              |
| 2.2     | `turbo` + `@turbo/gen` 2.8.14 → 2.10.12 (lodash/tmp/brace-expansion fix chain)                                                                                                                                                                                                                                             |
| 2.3     | Minors batch: `zod` 4.5.4 · `@trpc/*` 11.18.0 · `@tanstack/react-query` 5.102.8 · `@tanstack/react-virtual` 3.14.10 · `tailwindcss`+`@tailwindcss/postcss` 4.3.3 · `radix-ui` 1.6.7 · `tailwind-merge` 3.6.0 · `sonner` 2.0.8 · `postgres` 3.4.9 · `@t3-oss/env-nextjs` 0.13.11 (actualizar `pnpm-workspace.yaml` catalog) |
| 2.4     | `react`/`react-dom` 19.1.4 → 19.2.8 + `@types/react(-dom)` 19.2.x (catalog `react19`)                                                                                                                                                                                                                                      |
| 2.5     | `prettier` 3.9.6 + `prettier-plugin-tailwindcss` 0.8.1 + `jiti` 2.7.0 + `tsx` 4.23.x → re-ejecutar `pnpm format:fix`                                                                                                                                                                                                       |
| ✅ Gate | Pipeline completo + smoke de: wizard imports (xlsx virtualized), animaciones landing, toasts                                                                                                                                                                                                                               |

## Fase 3 — Majors acotadas con migración verificable (~60 min)

| #       | Paquete                                                   | Migración                                                                                                                               | Verificación específica                                                                               |
| ------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 3.1     | `@supabase/ssr` 0.6.1 → 0.12.5                            | API getAll/setAll ya usada; revisar chunked cookies, `encode`, PKCE flush en `packages/auth/{server,client,middleware}.ts` y `proxy.ts` | **Flow de auth completo**: login → refresh token → idle timeout → logout; cookies chunked en DevTools |
| 3.2     | `framer-motion` 12.38 → 13.2.0                            | Revisar `layout` props anidados en landing/módulos                                                                                      | Landing + wizards visualmente                                                                         |
| 3.3     | `lucide-react` 0.577 → 1.40.0                             | Typecheck detecta iconos eliminados; ajustar imports                                                                                    | `pnpm typecheck`                                                                                      |
| 3.4     | `eslint-plugin-react-hooks` 5.2 → 7.1.1                   | Corregir hallazgos de reglas nuevas (set-state-in-effect)                                                                               | `pnpm lint --force`                                                                                   |
| 3.5     | `lint-staged` 16 → 17                                     | Config compatible                                                                                                                       | Hook pre-commit                                                                                       |
| ✅ Gate | Pipeline + `browser-tester` sobre login/dashboard/catalog |

## Fase 4 — ESLint 10 + infra CI (~45 min)

| #               | Acción                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1             | `eslint` 9.39.4 → **10.9.1** (9.x EOL desde 2026-08-06) + `@eslint/js` 10.0.1 + `@eslint/compat` 2.1.0 + `typescript-eslint` 8.69.0 (catalog)                           |
| 4.2             | Validar `eslint-plugin-react` 7.37.5 bajo ESLint 10 (issue #3977): si crashea → aislar en config propia o mantener ESLint 9 solo para ese bloque; decidir con evidencia |
| 4.3             | **CI: Node 20 → 24** (`.github/workflows/ci.yml` `NODE_VERSION` + `@types/node` ^24 en catalog) — Node 20 EOL desde abril 2026                                          |
| 4.4             | CI: eliminar `continue-on-error` del audit (ya limpio), añadir paso `pnpm format`                                                                                       |
| 4.5             | `engines.node` raíz: `>=20.0.0` → `>=22.0.0` (o `>=24`) alineado con CI                                                                                                 |
| ⛔ **EXCLUIDO** | `typescript` 7.x — sin API para typescript-eslint hasta 7.1 (issue #12518). Revisar Q4-2026                                                                             |
| ✅ Gate         | Pipeline completo 2× (con y sin cache) + CI verde en rama de prueba                                                                                                     |

## Fase 5 — Cierre, documentación y memoria (~15 min)

| #   | Acción                                                                                       |
| --- | -------------------------------------------------------------------------------------------- |
| 5.1 | Actualizar `.gemini/knowledge/stack.md` con el nuevo inventario                              |
| 5.2 | Prepend entry en `.gemini/knowledge/state.md` (Session 87)                                   |
| 5.3 | `graphify update . && graphify cluster-only . --no-viz` (regenerar tras los cambios)         |
| 5.4 | Commits por fase (uno por fase, mensajes convencionales) — **solo con aprobación explícita** |
| 5.5 | Actualizar memory del proyecto (decisiones: TS se mantiene en 5.9, ESLint 10, Node 24)       |

---

## Presupuesto de riesgo

| Fase | Riesgo                                                               | Rollback                                                          |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0    | 🟢 Trivial                                                           | `git checkout -- .`                                               |
| 1    | 🟢 Bajo (parches intra-major; Next minor con advisories específicos) | checkout + install                                                |
| 2    | 🟢 Bajo                                                              | checkout + install                                                |
| 3    | 🟡 Medio (ssr cookies es lo más sensible)                            | checkout + install; ssr 0.12 es reversible a 0.6 (API compatible) |
| 4    | 🟡 Medio (ecosistema lint)                                           | Fase aislada y reversible                                         |
| 5    | 🟢 Trivial                                                           | n/a                                                               |

**Verificación global final**: `pnpm typecheck --force && pnpm lint --force && pnpm build && pnpm test --force && pnpm audit && pnpm lint:ws` + smoke browser (login → dashboard → catálogo → import wizard).
