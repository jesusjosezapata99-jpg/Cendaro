# PLAN — Rendimiento Real y Fluidez Perceptible · Cendaro ERP

**Fecha**: 2026-09-04 · **Rama**: `performance` · **Base**: Next 16.3.4 · React 19.2.8 · RQ 5.102.8 · tRPC 11.18 · Turbopack stable
**Restricción de producto clave**: usuarios en redes 3G/LTE venezolanas → la _percepción_ de fluidez es una feature, no un lujo.
**Método**: exploración completa del monorepo + deep research con doble verificación contra docs oficiales (Next.js, Supabase, tRPC, Google Fonts, NN/g). Cada afirmación técnica de este plan está validada; lo que no vale la pena está explícitamente rechazado al final.

---

## Contexto

El usuario reporta la experiencia objetivo: entrar al software debe sentirse **instantáneo y fluido**, sin "páginas de carga", con animaciones que comuniquen trabajo en segundo plano. Tras auditar el código, el estado real es mejor de lo esperado (el branch `performance` ya tiene SSR prefetch en el shell y 5 rutas principales, PPR activo, pool de DB bien afinado) — pero hay **4 cuellos de botella concretos** que rompen esa percepción:

1. **Material Symbols completo (295 KB) desde CDN de Google, render-blocking, en cada carga** — con flash de texto ("receipt_long") mientras la fuente llega. En 3G esto solo puede añadir 1–3 s.
2. **Un spinner artificial ("Resolviendo workspace…") en cada carga completa** aunque todos los datos ya vengan prefetcheados del servidor (gate de hidratación en `app-shell.tsx`).
3. **17+ rutas sin SSR prefetch** (solo 5 tienen `HydrationBoundary`) → el usuario ve esqueletos _después_ de cargar JS, en vez de contenido streamed desde el HTML.
4. **2 round-trips de red a Supabase Auth por cada navegación** (`getUser()` en `proxy.ts` y en el contexto tRPC server) — Supabase documenta `getClaims()` como el reemplazo rápido.

---

## Lo que YA está bien (no tocar — evita trabajo redundante)

| Área                                                                                                                 | Evidencia                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| PPR / cacheComponents activo, 39 rutas parcialmente prerenderizadas                                                  | `next.config.js` (`cacheComponents: true`), build 44 rutas |
| SSR prefetch del shell (users.me, workspace.list, latestRates) + dashboard/catalog/inventory/orders/quotes/customers | `(app)/layout.tsx`, `*/page.tsx` con `HydrationBoundary`   |
| `keepPreviousData` en catálogo (sin flash entre páginas)                                                             | `catalog/client.tsx:49`                                    |
| staleTime 5 min, gcTime 10 min, retry con skip en UNAUTHORIZED                                                       | `trpc/query-client.ts`                                     |
| Pool Postgres: session pooler, `prepare`, warmPool en `instrumentation.ts`, max_lifetime anti-Supavisor              | `packages/db/src/client.ts`                                |
| Caches de permisos/membership (TTL 5 min/1 min) + `workspaceReadProcedure` sin overhead de transacción               | `packages/api/src/trpc.ts`                                 |
| Virtualización en imports pesados (@tanstack/react-virtual)                                                          | `modules/*/steps/validation-preview.tsx`                   |
| Dependencias al día (plan Session 87 ejecutado: Next 16.3.4, sharp 0.35.4, drizzle 0.45.2)                           | `package.json`                                             |

---

## Hallazgos priorizados

| #      | Problema (verificado en código)                                                                                                                                                                                              | Impacto                                                     | Solución (validada en docs oficiales)                                                                                                                                                                                                                                                                                                                | Esfuerzo/Riesgo |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **H1** | Material Symbols **completo (295 KB)** desde `fonts.googleapis.com`, stylesheet render-blocking en `<head>`; FOUC de ligaduras (texto visible); viola el estándar propio (lucide-react only). 271 usos, ~60 iconos distintos | 🔴 Crítico en 3G                                            | **Subset oficial** `&icon_names=` (lista ordenada de los ~60 iconos) → **~1.7 KB** (dato oficial Google: 295 KB → 1.7 KB), self-hosted con `next/font/local` + reglas CSS manuales (mismo origen → CSP `font-src 'self'` ya cubre)                                                                                                                   | 0.5 día / 🟢    |
| **H2** | `WorkspaceGate` en `app-shell.tsx:20-44`: spinner "Resolviendo workspace…" en **toda** carga, aunque el cookie ya llegue por SSR                                                                                             | 🔴 Percepción — es la "página de carga" que el usuario odia | `isReady` inicial desde `initialWorkspaceId` (ya se pasa server-side); queries workspace-scoped con `enabled: isReady`; conservar fallback solo para first-login sin cookie                                                                                                                                                                          | 0.5 día / 🟡    |
| **H3** | 17+ rutas client-fetch-only (payments, containers, vendors, pricing, rates, settings, users, alerts, audit, cash-closure, delivery-notes, invoices, marketplace, whatsapp, accounts-receivable + todas las `[id]`)           | 🔴 Arquitectónico                                           | Estandarizar prefetch con `createTRPCOptionsProxy` (docs tRPC v11): `queryClient.prefetchQuery(trpc.x.y.queryOptions(input))` — **misma key que el cliente**, elimina los queryKeys manuales frágiles que hoy se duplican a mano; extender a todas las rutas + `[id]` con `params`                                                                   | 2–3 días / 🟡   |
| **H4** | Un único `loading.tsx` genérico para todas las rutas; sin feedback por-link en sidebar                                                                                                                                       | 🟠 Percepción                                               | `loading.tsx` por segmento que imite el layout final (NN/g: skeleton de pantalla completa > spinner; **con delay 100–300 ms** para no flashear en cargas rápidas) + `useLinkStatus` (estable desde 15.3) con shimmer delay en `Sidebar`                                                                                                              | 1 día / 🟢      |
| **H5** | `supabase.auth.getUser()` = round-trip de red en `proxy.ts:147` y `trpc/server.ts:42` (cada navegación/RSC)                                                                                                                  | 🟠 Latencia servidor                                        | `getClaims()` — docs oficiales: _"significantly faster… Prefer over getUser"_, JWKS cacheado localmente. **Precondición**: JWT signing keys asimétricas (verificar en Supabase Dashboard → Settings → JWT Keys; si el proyecto usa HS256 simétrico, getClaims degrada a red y no se hace)                                                            | 0.5 día / 🟡    |
| **H6** | 0 usos de `useOptimistic`/`useTransition`; mutaciones = spinner + refetch                                                                                                                                                    | 🟠 Percepción en flujos clave                               | Optimistic UI con `onMutate` de TanStack Query (patch de caché + rollback) en pagos/pedidos/cotizaciones; botones con estado pending                                                                                                                                                                                                                 | 1–2 días / 🟡   |
| **H7** | Dev local: sin caché persistente de Turbopack; Defender escanea `node_modules`/`.next`; doble watcher (`graphify watch` + `turbo watch dev`)                                                                                 | 🟡 Dev experience                                           | `experimental.turbopackFileSystemCacheForDev: true` (docs oficiales Next 16); exclusiones de Defender (documentadas); medir overhead de `graphify watch` y hacerlo opcional                                                                                                                                                                          | 0.5 día / 🟢    |
| **H8** | Membership = 2 queries (`is_workspace_member()` + plan) en cold path                                                                                                                                                         | 🟡 Menor                                                    | Consolidar en 1 SQL JOIN (mismo resultado, menos 1 round-trip)                                                                                                                                                                                                                                                                                       | 0.5 día / 🟢    |
| **H9** | Transiciones de ruta cortantes; re-renders sin memoizar en tablas client                                                                                                                                                     | ⚪ Opcional                                                 | (a) View Transitions: `experimental.viewTransition: true` + `<ViewTransition>` (docs Next actualizadas ago-2026; Chromium 125+/Safari 18+, degradación elegante). (b) React Compiler en modo `annotation` (`reactCompiler` es **stable** en Next 16 pero exige `babel-plugin-react-compiler` y ralentiza builds) — solo si el perfilado lo justifica | 1 día c/u / 🟡  |

---

## Fases de implementación

### Fase 0 — Baseline de medición (0.5 día) — _sin datos no hay optimización_

- `useReportWebVitals` (API estable de Next) → logger del proyecto; registrar LCP/INP/CLS/FCP/TTFB por ruta.
- Captura manual DevTools → throttling "Slow 4G/Fast 3G" + Lighthouse de: login → dashboard → catálogo → inventario (screenshots before/after).
- `pnpm build` y anotar pesos de chunks de las rutas principales.
- **Artefacto**: `.opencode/reports/PERF-BASELINE-2026-09.md`
- ✅ Gate: baseline documentado.

### Fase 1 — Quick wins de percepción (1 día, mayor ROI del plan)

1. **H1**: subset Material Symbols (`icon_names`, alfabetizado, incluir iconos dinámicos de `sidebar.tsx`/`dashboard/client.tsx`/`notifications-dropdown.tsx`) → woff2 self-hosted + `next/font/local`; eliminar `<link>` externos de `app/layout.tsx`; reglas `.material-symbols-outlined` en `globals.css` (con `font-display: block` para ocultar ligaduras durante el swap).
2. **H2**: eliminar el gate artificial en `app-shell.tsx`/`providers.tsx`; `isReady` derivado de `initialWorkspaceId`; queries dependientes con `enabled: isReady`.
3. **H4-partial**: utilidad `DelayedSkeleton` (delay ~200 ms, estilo NN/g) para no flashear esqueletos en cargas <300 ms.
4. **H4-partial**: shimmer por-link en `Sidebar` con `useLinkStatus` + CSS del patrón oficial (delay 100 ms).

- ✅ Gate: `pnpm typecheck && pnpm lint && pnpm build && pnpm test` + smoke browser (login→dashboard→catálogo) verificando **cero spinner visible** con sesión y caché templada.

### Fase 2 — Navegación instantánea en toda la app (2–3 días)

1. **H3**: `trpc/server.ts` → `createTRPCOptionsProxy` + helpers `prefetch()`/`HydrateClient`; refactor de las 5 páginas que hoy duplican queryKeys a mano (deuda real: una key mal escrita = caché no golpeada).
2. **H3**: SSR prefetch en las ~17 rutas restantes y páginas `[id]` (prefetch con `params` bajo el boundary de Suspense existente).
3. **H4**: `loading.tsx` por segmento imitando el layout final (KPIs en dashboard, tabla en catálogo/inventario, tabs+header en `[id]`).
4. **H6**: optimistic updates (`onMutate` + rollback) en mutaciones de alta frecuencia (pagos, estados de pedidos/cotizaciones); pendientes en botones.

- ✅ Gate: `browser-tester` sobre navegación completa; CLS ≈ 0 entre skeleton→contenido; datos visibles en first paint (RSC) en rutas migradas.

### Fase 3 — Latencia de servidor (1–2 días)

1. **H5**: `getClaims()` en `proxy.ts` y `trpc/server.ts` — **precondición**: confirmar claves JWT asimétricas en el dashboard de Supabase (si no, no se aplica y se documenta el porqué).
2. **H8**: JOIN único para membership+plan en `packages/api/src/trpc.ts`.
3. Revisar `staleTime` por tipo de dato (tasas ya 1 h; catálogo 5 min razonable).

- ✅ Gate: flujo de auth completo (login → refresh → idle timeout → logout) + suite Vitest de `packages/api` + tests de RLS sin cambios.

### Fase 4 — Dev experience local (0.5–1 día)

1. **H7**: `experimental.turbopackFileSystemCacheForDev: true` (cold starts entre reinicios); `turbopackMemoryEviction: 'auto'` (default).
2. **H7**: documentar/gestionar exclusiones de Windows Defender para `node_modules`, `.next`, `.turbo`, store de pnpm (requiere admin — se entrega el script, el usuario decide).
3. Medir CPU/RSS de `graphify watch` durante dev; si es relevante, queda solo en `pnpm dev:graph` (ya existe como script separado).

- ✅ Gate: tiempos de cold start y HMR antes/después (el logging mejorado de Next 16 lo muestra por request).

### Fase 5 — Opcional/experimental (solo si Fases 0–4 estables)

- **H9a** View Transitions en navegaciones del `(app)` (flag experimental; degrada sin animación donde no hay soporte).
- **H1-estructural**: migración a lucide-react (271 usos / ~40 archivos, incremental por carpeta) — elimina la dependencia de iconos externos para siempre y alinea con el estándar del proyecto.
- **H9b** React Compiler (`compilationMode: "annotation"`) solo si el perfilado muestra re-renders costosos en tablas client.
- Auditoría de bundle con el Bundle Analyzer de Next 16.

---

## Lo que NO recomiendo (double-check crítico)

| Rechazado                               | Por qué (evidencia)                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| framer-motion en el shell/ERP           | El CSS existente (`tw-animate-css` + keyframes en `globals.css`) cubre entrances/shimmers; framer-motion añade ~30–50 KB al bundle client para algo que CSS hace a 60 fps. Ya está aislado en la landing, que es donde aporta. |
| Esqueletos por doquier sin delay        | NN/g: en cargas <1 s el skeleton que flashea empeora la percepción. Por eso Fase 1 incluye el delay de ~200 ms.                                                                                                                |
| Capa de caché Redis/Upstash             | Prematuro: staleTime 5 min + PPR + caches de membership/permisos ya cubren el patrón de lectura del ERP. Añadiría latencia de red nueva, costo y un segundo lugar de invalidación.                                             |
| Service Worker / PWA offline            | Valiosísimo para Venezuela, pero es scope creep con invalidación compleja — candidata a plan propio posterior.                                                                                                                 |
| Paquete npm `material-symbols` completo | Embarca los 3.800+ iconos (~300 KB). Estrictamente peor que el subset de 1.7 KB.                                                                                                                                               |
| Activar React Compiler global ya        | Estable pero no default; aumenta tiempos de build y su beneficio es marginal en páginas server-component. Solo modo `annotation` tras perfilado.                                                                               |
| Polling más agresivo de notificaciones  | 60 s actual es razonable en redes caras; bajarlo gastaría datos sin mejorar percepción.                                                                                                                                        |

---

## Verificación end-to-end

1. **Por fase**: `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (gates ya institucionalizados en este repo).
2. **UX**: agente `browser-tester` — login → dashboard → catálogo → inventario → pedidos → detalle, con y sin throttling de red; validar: sin spinner artificial, skeletons con delay, shimmer en links, contenido en first paint.
3. **Métricas**: comparar contra baseline de Fase 0. Objetivos honestos en Fast 3G: LCP del shell <2.5 s, INP <200 ms, CLS <0.05, cero solicitudes a fonts.googleapis.com/gstatic en runtime.
4. **Verificación puntual por hallazgo**: H1 → pestaña Network sin fonts.gstatic + sin FOUC; H2 → recarga dura con caché templada sin "Resolviendo workspace…"; H5 → en DevTools/Network del server, cero llamadas a `/auth/v1/user` por navegación.
5. **Rollback por fase**: `git checkout -- .` + `pnpm install` (patrón ya usado en el plan Session 87).

## Archivos críticos a modificar

- `apps/erp/src/app/layout.tsx` — eliminar CDN de fuentes, `next/font/local`
- `apps/erp/src/app/(app)/app-shell.tsx`, `providers.tsx` — eliminar gate artificial
- `apps/erp/src/app/(app)/loading.tsx` + nuevos `loading.tsx` por segmento
- `apps/erp/src/components/sidebar.tsx` — `useLinkStatus`
- `apps/erp/src/trpc/server.ts` — `createTRPCOptionsProxy` + `getClaims()`
- `apps/erp/src/proxy.ts` — `getClaims()`
- `packages/api/src/trpc.ts` — JOIN de membership
- `apps/erp/next.config.js` — `turbopackFileSystemCacheForDev`, (opcional `viewTransition`)
- `globals.css` — reglas del icon-font subseteado, utilidades de shimmer/delay
- ~17 `page.tsx` de rutas restantes — patrón SSR prefetch (se describe una vez, se repite)

## Nota de protocolo

Tras aprobación, este plan se persiste como `.opencode/plans/PLAN-2026-09-PERFORMANCE-UX.md` (protocolo del proyecto) y cada fase termina con entrada en `.gemini/knowledge/state.md`. Los commits requieren aprobación explícita del usuario (guardarrail del proyecto).
