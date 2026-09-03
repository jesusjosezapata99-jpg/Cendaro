# AUDIT REPORT — Baseline Refresh 2026-09

**Proyecto**: Cendaro ERP (`c:\Users\jzs99\Desktop\TEST`) · **Rama**: `performance` · **Último commit**: 15de6a6 (2026-05-22)
**Auditoría ejecutada**: 2026-09-03 · **Proyecto congelado**: ~3.5 meses

---

## 1. Resumen Ejecutivo

El monorepo está **estructuralmente sano** (typecheck/lint/build/test en verde con cache forzado) pero **obsoleto en seguridad y dependencias**: 3.5 meses de deriva producen **17+ advisories de seguridad** (2 production-critical paths: `next` y `drizzle-orm`), **~137 archivos con drift de formato**, **CI corriendo sobre Node 20 (EOL desde abril 2026)** y varias majors disponibles. El knowledge graph de Graphify está **al día** (construido desde el commit HEAD actual).

| Dimensión                | Estado    | Detalle                                                              |
| ------------------------ | --------- | -------------------------------------------------------------------- |
| Typecheck (forzado)      | ✅ PASS   | 6/6 workspaces, 5.1s                                                 |
| Build Next 16.1.7        | ✅ PASS   | 44 rutas (39 PPR ◐, 4 estáticas ○, 7 dinámicas ƒ)                    |
| Tests Vitest 4.0.18      | ✅ PASS   | 39/39 (schema 36, router 3)                                          |
| Lint ESLint 9.39.4       | ✅ PASS   | 6/6 workspaces                                                       |
| Format Prettier 3.8.1    | ❌ FAIL   | **137 archivos ERP + todos los packages** con drift                  |
| Seguridad (`pnpm audit`) | 🚨 FAIL   | 1 crítico + 16 high (5 en deps de producción)                        |
| Dependencias             | ⚠️ STALE  | 45 paquetes desactualizados (12 majors)                              |
| CI                       | ⚠️ RIESGO | Node 20 EOL · `audit` con `continue-on-error` · sin check de formato |
| Graphify                 | ✅ FRESH  | 7,358 nodos · 8,293 edges · 640 comunidades · built desde HEAD       |

---

## 2. Vulnerabilidades (pnpm audit, orden de prioridad)

### Producción (crítico parchear)

| Severidad  | Paquete                            | Actual  | Vulnerable | Patched  | Advisory                                                         | Impacto                                                                                                                                                                                                              |
| ---------- | ---------------------------------- | ------- | ---------- | -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 HIGH ×7 | `next`                             | 16.1.7  | <16.2.11   | ≥16.2.11 | GHSA-q4gf/8h8q/26hh/mg66/c4j6/492v/267c/36qx/6gpp/m99w/89xv/p9j2 | **Middleware/Proxy bypass ×5** (segment-prefetch, param injection, i18n, Turbopack) — afecta directamente a `apps/erp/src/proxy.ts`; DoS Server Components/Actions; SSRF (WebSocket, rewrites); DoS Cache Components |
| 🔴 HIGH    | `drizzle-orm`                      | 0.45.1  | <0.45.2    | ≥0.45.2  | GHSA-gpj5-g38j-94v9                                              | **SQL injection via escape incorrecto de identificadores**                                                                                                                                                           |
| 🔴 HIGH    | `sharp`                            | 0.34.5  | <0.35.0    | ≥0.35.0  | GHSA-f88m-g3jw-g9cj                                              | 4 CVEs de libvips (CVE-2026-33327/33328/35590/35591)                                                                                                                                                                 |
| 🔴 HIGH    | `ws` (via `@supabase/realtime-js`) | <8.21.0 | ≥8.0.0     | ≥8.21.0  | GHSA-96hv-2xvq-fx4p                                              | Memory exhaustion DoS                                                                                                                                                                                                |
| 🔴 HIGH    | `postcss` (via next + tailwind)    | ≤8.5.11 | —          | ≥8.5.12  | GHSA-6g55-p6wh-862q                                              | Arbitrary file read via sourceMappingURL                                                                                                                                                                             |

### Dev/tooling

| Severidad   | Paquete                                               | Actual | Patched                                            | Advisory                                                                                          |
| ----------- | ----------------------------------------------------- | ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 🟠 CRITICAL | `vitest`                                              | 4.0.18 | ≥4.1.0                                             | GHSA-5xrq-8626-4rwp (arbitrary file read/exec via UI server)                                      |
| 🟠 HIGH ×3  | `vite` (via vitest)                                   | ≤7.3.4 | ≥7.3.5                                             | GHSA-v2wj/p9ff/fx2h (fs.deny bypass, Windows paths)                                               |
| 🟠 HIGH     | `lodash`, `tmp`, `brace-expansion` (via `@turbo/gen`) | —      | lodash ≥4.18.0, tmp ≥0.2.6, brace-expansion ≥5.0.7 | Los overrides actuales de `package.json` raíz están **desactualizados** frente a estos advisories |
| 🟠 HIGH     | `js-yaml` (via eslint>eslintrc)                       | <4.3.0 | ≥4.3.0                                             | GHSA-52cp-r559-cp3m                                                                               |

---

## 3. Matriz de dependencias (actual → latest)

### Minors/patches de producción (bajo riesgo)

`drizzle-orm` 0.45.1→0.45.2 · `drizzle-kit` 0.31.9→0.31.10 · `postgres` 3.4.8→3.4.9 · `@supabase/supabase-js` 2.100.1→2.114.0 · `@tanstack/react-query` 5.90.21→5.102.8 · `@tanstack/react-virtual` 3.13.23→3.14.10 · `@trpc/*` 11.12.0→11.18.0 · `zod` 4.3.6→4.5.4 · `tailwindcss` + `@tailwindcss/postcss` 4.2.1→4.3.3 · `radix-ui` 1.4.3→1.6.7 · `tailwind-merge` 3.5.0→3.6.0 · `sonner` 2.0.7→2.0.8 · `sharp` 0.34.5→0.35.4 · `next` 16.1.7→16.3.4 · `react`/`react-dom` 19.1.4→19.2.8 (+`@types/react` 19.1.17→19.2.18) · `@t3-oss/env-nextjs` 0.13.10→0.13.11

### Majors con migración acotada

| Paquete                       | Actual→Latest   | Riesgo    | Notas                                                                                                                                                         |
| ----------------------------- | --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `framer-motion`               | 12.38.0→13.2.0  | Bajo      | Guía oficial: "no breaking changes in 13 for JS users"; revisar `layout` props anidados                                                                       |
| `lucide-react`                | 0.577.0→1.40.0  | Bajo      | 1.0 estable; typecatch detectará iconos eliminados                                                                                                            |
| `@supabase/ssr`               | 0.6.1→0.12.5    | **Medio** | Breaking: API cookies `get/set/remove`→`getAll/setAll` — **ya implementada** en `packages/auth`/`proxy.ts`; verificar chunked cookies + `encode` + flush PKCE |
| `eslint`                      | 9.39.4→10.9.1   | Medio     | **ESLint 9 EOL: 2026-08-06**. Breaking: Node ≥20.19, `Program` AST range, jiti ≥2.2 (OK: tenemos 2.6.1)                                                       |
| `eslint-plugin-react-hooks`   | 5.2.0→7.1.1     | Bajo      | Soporta ESLint 10; reglas nuevas (`set-state-in-effect` mejorado) pueden revelar issues                                                                       |
| `@eslint/compat`              | 1.4.1→2.1.0     | Bajo      | Acompaña ESLint 10                                                                                                                                            |
| `lint-staged`                 | 16.3.3→17.4.1   | Bajo      | —                                                                                                                                                             |
| `prettier-plugin-tailwindcss` | 0.6.14→0.8.1    | Bajo      | Re-formateo posterior                                                                                                                                         |
| `@types/node`                 | 22.19.15→26.4.1 | Medio     | Alinear al runtime elegido (recomendado ^24)                                                                                                                  |

### Decisiones de NO actualizar (criterio estabilidad > novedad)

| Paquete                           | Decisión                     | Razón                                                                                                                                                   |
| --------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript` 5.9.3                | **MANTENER**                 | TS 7.0.2 (jul-2026, nativo Go, 10× más rápido) **no tiene API programática hasta 7.1** → `typescript-eslint` crashea (issue #12518). Revisar en Q4-2026 |
| `eslint-plugin-react` 7.37.5      | Mantener/pin                 | Issue #3977 abierto de compat con ESLint 10 — validar en Fase 4 antes de subir                                                                          |
| `xlsx` (CDN SheetJS)              | Mantener                     | Estrategia vigente (3-03-2026); vigilar supply-chain                                                                                                    |
| `typescript-eslint` 8.57.2→8.69.0 | Subir solo junto a ESLint 10 | Alineación de release                                                                                                                                   |

---

## 4. Hallazgos de código/config (verificados leyendo fuente)

1. **`apps/erp/src/proxy.ts`** — sólido: allowlist anti-open-redirect, idle-timeout 30min, cookie firmada. ⚠️ Pero depende del middleware de Next → los bypass advisories de `next <16.2.11` aplican directamente. Los env vars faltantes dejan pasar la request (`if (!supabaseUrl) return NextResponse.next()`) — aceptable en build-stub, riesgo menor en producción mal configurada.
2. **`packages/api/src/trpc.ts`** — arquitectura RBAC correcta (permission cache 5min TTL con eviction, membership cache 60s, split read/write procedures). Sin cambios necesarios.
3. **`packages/db/src/client.ts`** — pooling Supabase-aware correcto (session-mode 5432, max 3, prepare condicional). OK.
4. **`apps/erp/next.config.js`** — CSP completa y correcta (`frame-ancestors`, `upgrade-insecure-requests`, connect-src acotado). ⚠️ **`metadataBase` no configurado** → warning ×2 en build (OG images resuelven a `http://localhost:3000`).
5. **CI (`.github/workflows/ci.yml`)** — 🚨 `NODE_VERSION: "20"` (**Node 20 EOL: 2026-04-30**); `pnpm audit --prod --audit-level=high` con `continue-on-error: true` → los advisories HIGH actuales pasan en silencio; **no hay paso de formato** → explica el drift de 137 archivos.
6. **Format drift masivo** — 137 archivos ERP + todos los packages fallan `prettier --check`. Causa probable: commits con hooks bypasseados o cambio de plugin sin re-format. Fix: `pnpm format:fix` (1 comando).
7. **`apps/web/`** — directorio huérfano con solo `public/cendaro-logo.png`, sin `package.json` → warning sherif (`packages-without-package-json`).
8. **`pnpm.overrides` raíz desactualizados** — `tmp ^0.2.5` (patched ≥0.2.6), `brace-expansion <5.0.7` vulnerable; faltan overrides para `postcss`, `lodash`, `ws`.
9. **Build warning** — "Using edge runtime on a page currently disables static generation" (benigno, documentar).
10. **`NODE_TLS_REJECT_UNAUTHORIZED=0`** aparece en el entorno pnpm (warning en sherif/dlx) — riesgo de entorno local (proxy corporativo?), no del proyecto. Revisar variables de usuario.

## 5. Graphify (verificado)

`GRAPH_REPORT.md` construido desde `15de6a64` = HEAD actual (`15de6a6`) → **grafo 100% sincronizado** con el árbol (sin cambios desde 2026-05-22). 7,358 nodos · 8,293 edges · 640 comunidades · 99% EXTRAÍDO / 1% INFERIDO. Hooks Husky con fallback `cluster-only` operativos según Session 86. **No requiere acción.**

## 6. Riesgos del baseline si no se actúa

- Middleware bypass público en producción (Next <16.2.11) — el ERP entero se protege por proxy.ts.
- SQL injection vectorial en Drizzle con identificadores dinámicos.
- CI sobre Node EOL sin señal de seguridad real (audit silenciado).
- Drift de formato creciente → PRs ruidosos y lint-staged fallando en cada commit futuro.
