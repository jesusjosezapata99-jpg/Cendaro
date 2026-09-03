# REFRESH REPORT — Baseline Execution 2026-09

**Proyecto**: Cendaro ERP · **Rama**: `performance` · **Ejecución**: 2026-09-03 (Sessions 88 + 89, hilos paralelos)
**Base**: `AUDIT-REPORT-2026-09-BASELINE-REFRESH.md` + `PLAN-2026-09-BASELINE-REFRESH.md`

---

## 1. Resultado final

**Todas las fases (0→5) ejecutadas y validadas en verde.**

| Verificación                           | Antes (2026-05-22)                         | Después (2026-09-03)                                           |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `pnpm audit` (árbol completo)          | 🚨 1 crítico + 16 high                     | ✅ **0 vulnerabilidades**                                      |
| `pnpm audit --prod --audit-level=high` | 🚨 FAIL (7 advisories next, SQLi drizzle)  | ✅ **0 vulnerabilidades**                                      |
| Next.js                                | 16.1.7 (middleware/proxy bypass ×5)        | **16.3.4**                                                     |
| ESLint                                 | 9.39.4 (**EOL desde 2026-08-06**)          | **10.9.1**                                                     |
| React                                  | 19.1.4                                     | **19.2.8**                                                     |
| Typecheck + Lint (--force)             | 12/12                                      | ✅ 12/12 (cero errores nuevos tras 2 majors de tooling)        |
| Build                                  | 5/5                                        | ✅ 5/5 — `/opengraph-image` ahora **○ Static**                 |
| Tests                                  | 39/39                                      | ✅ 39/39                                                       |
| CI                                     | Node 20 (EOL 2026-04-30), audit silenciado | **Node 24**, audit **enforzado**, paso **Format** añadido      |
| Sherif                                 | warnings (apps/web)                        | ✅ "No issues found"                                           |
| Graphify                               | 7,358 nodos (HEAD 2026-05-22)              | ✅ Regenerado: **7,388 nodos / 8,323 edges / 640 comunidades** |

## 2. Cambios por categoría

### Seguridad de producción (Fase 1)

- `next ^16.3.4` — parchea 7 advisories (proxy/middleware bypass ×5, SSRF, DoS Cache Components). **Era el vector más crítico: todo el ERP se protege vía `proxy.ts`.**
- `drizzle-orm ^0.45.2` — SQL injection en escape de identificadores.
- `sharp ^0.35.4` — 4 CVEs de libvips.
- `@supabase/supabase-js ^2.114.0` (apps/erp, api, auth) · `ws ≥8.21.0` · `postcss ≥8.5.12` · `js-yaml ^4.3.1` · `@humanfs/node ^0.16.8` · `vite ^7.3.5` (overrides + devDep explícita en `packages/api`).

### Majors acotadas (Fases 3–4) — migración verificada sin cambios de código

- `@supabase/ssr 0.6.1→0.12.5` — API `getAll/setAll` ya encapsulada en `packages/auth` (3 wrappers, 7 call sites).
- `framer-motion 12.38→13.2.0` — guía oficial: sin breaking para JS; uso acotado a 8 componentes landing sin props `layout`.
- `lucide-react 0.577→1.40.0` — el proyecto usa **cero** brand icons (los únicos eliminados en 1.0).
- `ESLint 9→10.9.1` (+ `@eslint/js 10`, `@eslint/compat 2.1`, `typescript-eslint 8.69`, `react-hooks 7.1.1`) — compat resuelta con `fixupPluginRules` en `tooling/eslint/react.ts` (Session 88) y pin de reglas react-hooks; el riesgo documentado del issue #3977 quedó mitigado.

### Minors/patches (Fase 2)

`@trpc/* 11.18.0` · `zod 4.5.4` · `tailwindcss+postcss 4.3.3` · `react-query 5.102.8` · `react-virtual 3.14.10` · `turbo/@turbo/gen 2.10.12` · `prettier 3.9.6` + plugin-tailwindcss 0.8.1 · `vitest 4.1.11` (elimina crítico GHSA-5xrq) · `postgres 3.4.9` · `drizzle-kit 0.31.10` · `radix-ui 1.6.7` · `tailwind-merge 3.6.0` · `sonner 2.0.8` · `@t3-oss/env-nextjs 0.13.11` · `@types/node ^24` · `jiti 2.7.0` · `tsx 4.23.13` · `lint-staged 17.4.1` · `react/react-dom 19.2.8`.

### Fixes de código aplicados

1. `apps/erp/src/app/layout.tsx` + `src/env.ts` — `metadataBase` con `env` validado (nueva var opcional `VERCEL_URL`). Elimina warning de build y fija canónica de OG images.
2. `apps/erp/src/app/opengraph-image.tsx` — eliminado `runtime = "edge"` (error duro con `cacheComponents` en Next 16.3; guía oficial de migración). La ruta OG ahora se prerenderiza estática.
3. `tooling/eslint/react.ts` — `fixupPluginRules` para plugins react/react-hooks bajo ESLint 10 + pin de reglas (Session 88).
4. `packages/api/src/modules/*` + `parse-packing-list/route.ts` — imports muertos, `no-useless-assignment`, type assertions (Session 88, `lint:fix`).
5. `.github/workflows/ci.yml` — Node 24, audit sin `continue-on-error`, paso Format. `engines.node >=22.0.0`.

## 3. Decisiones de NO actualizar (estabilidad > novedad)

| Paquete                      | Decisión | Razón                                                                                                  |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `typescript` 5.9.3           | **Hold** | TS 7 nativo (jul-2026) sin API programática → `typescript-eslint` incompatible. Revisar Q4-2026 (7.1). |
| `eslint-plugin-react` 7.37.5 | Pin      | Issue #3977; funciona bajo ESLint 10 vía `fixupPluginRules`.                                           |
| `xlsx` (SheetJS CDN)         | Mantener | Estrategia vigente; vigilar supply-chain.                                                              |

## 4. Riesgos residuales / seguimiento

1. **`NODE_TLS_REJECT_UNAUTHORIZED=0`** en el entorno local (no del proyecto) — revisar variables de usuario / proxy corporativo.
2. **Smoke test manual pendiente**: `pnpm dev:erp` → login → dashboard → catálogo/import wizard → landing (animaciones framer-motion 13) → toasts.
3. **Deploy**: verificar variables en Vercel (Node 24 runtime) tras merge a `main`.
4. TS 7.1 (API programática) → calendario Q4-2026.

## 5. Estado del árbol de trabajo

Todo el trabajo está **sin commitear** en `performance` (incluye los cambios pre-existentes de mayo). Propuesta de commit: 1 commit por fase (0–4) o un único commit `chore(baseline)` — pendiente de aprobación explícita del usuario (guardrail del proyecto).
