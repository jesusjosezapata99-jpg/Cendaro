# PERF-REPORT — Rendimiento Real y Fluidez Perceptible · Cendaro ERP

> **Plan fuente**: `.opencode/plans/PLAN-2026-09-PERFORMANCE-UX.md`
> **Fecha**: 2026-09-04 · **Rama**: `performance` · **Stack**: Next 16.3.4 · React 19.2.8 · TanStack Query 5.102.8 · tRPC v11.18 · Drizzle 0.45.2
> **Restricción de producto**: usuarios en redes 3G/LTE venezolanas → la percepción de fluidez es una feature.
> **Estado**: Fases 0–4 EJECUTADAS. Gate final verde: `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` 39/39 · `pnpm build` ✓ (44 rutas, 39 PPR).

---

## Resultados por hallazgo

### Fase 0 — Baseline

- Arquitectura documentada antes de tocar código: PPR activo, 5 rutas con prefetch SSR manual (queryKeys duplicados a mano), pool DB afinado, caches de membership/permisos existentes.
- Baseline de chunks y Web Vitals capturado durante la investigación previa al plan (objeto del plan original).

### Fase 1 — Quick wins de percepción ✅

| #      | Cambio                                     | Detalle                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **H1** | Material Symbols subseteado y self-hosted  | 295 KB desde CDN de Google (render-blocking, con FOUC de ligaduras) → subset `&icon_names=` (~60 iconos usados realmente, incluidos los dinámicos de sidebar/dashboard/notificaciones) servido localmente, **~10.8 KB woff2**. `<link>` externos eliminados de `app/layout.tsx`; reglas `.material-symbols-outlined` en `globals.css` con `font-display: block`. CSP `font-src 'self'` ya cubría; cero requests a `fonts.googleapis.com/gstatic` en runtime. |
| **H2** | Spinner "Resolviendo workspace…" eliminado | `app-shell.tsx`/`providers.tsx`: `isReady` derivado de `initialWorkspaceId` (SSR) en vez de esperar hidratación; queries workspace-scoped con `enabled: isReady`; fallback solo para first-login sin cookie.                                                                                                                                                                                                                                                 |
| **H4** | `Delayed` + skeletons por-link             | Componente `Delayed` (200 ms, criterio NN/g: cargas <200 ms nunca flashean skeleton). `useLinkStatus` con shimmer en `Sidebar` (delay 100 ms).                                                                                                                                                                                                                                                                                                               |

### Fase 2 — Navegación instantánea en toda la app ✅

| #      | Cambio                                             | Detalle                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H3** | `createTRPCOptionsProxy` (patrón oficial tRPC v11) | `trpc/server.ts` reescrito: `createTRPCOptionsProxy({ router, ctx, queryClient })` — `trpc.x.y.queryOptions(input)` genera la **misma queryKey que los hooks del cliente**, eliminando la duplicación manual de keys (un typo = caché no golpeada + doble fetch). `getQueryClient()` ahora es request-stable vía `cache()` de React (requisito oficial del patrón). 6 páginas refactorizadas que duplicaban keys a mano.                                                     |
| **H3** | 21 rutas convertidas a Server Component + prefetch | Patrón estándar: `page.tsx` (server, Suspense + skeleton) → prefetch con `queryOptions(input)` → `HydrationBoundary` → `client.tsx` (código byte-idéntico, movido con `Move-Item`). Cobertura: whatsapp, vendors, users, pricing, payments, marketplace, containers (+[id]), cash-closure, audit, alerts, accounts-receivable (+[id]), rates, orders/[id], inventory/warehouse/[id], customers/[id], catalog/[id]/suppliers/categories/brands/new. 39 rutas PPR en el build. |
| **H4** | Skeletons por tipo de página                       | `skeleton.tsx`: `ListPageSkeleton` (header+stats+chips+tabla), `DashboardSkeleton` (6 KPIs+2 paneles+cierres), `DetailSkeleton` (título+tabs+2 columnas). Imitan el layout final → CLS ≈ 0. Todos Delayed-wrapped.                                                                                                                                                                                                                                                           |
| **H6** | Optimistic UI en `validatePayment`                 | `onMutate`: cancela query, patch de caché (`isValidated: true`) con la key tipada `trpc.sales.listPayments.queryKey(...)`; `onError` rollback; `onSettled` invalida. En 3G el feedback es instantáneo; el server reconcilia siempre.                                                                                                                                                                                                                                         |

### Fase 3 — Latencia de servidor ✅

| #      | Cambio                                      | Detalle                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H5** | `getUser()` → `getClaims()` (3 puntos)      | `proxy.ts` (middleware), `app/api/trpc/[...trpc]/route.ts` y `trpc/server.ts`: verificación local del JWT vía JWKS cacheado (claves asimétricas) en vez de round-trip de red a Supabase Auth por request/navegación.                                                                                                                                                                                                                                  |
| **H5** | Tipo de contexto mínimo `AuthenticatedUser` | `{ id, email?, user_metadata?: UserMeta }` — verificado exhaustivamente (grep): es exactamente lo que RBAC y auditoría consumen. `mapClaimsToUser()` en `packages/api/src/trpc.ts` mapea claims verificados; **eliminó los 2 casts `as any`** existentes (estándar zero-any). Trade-off documentado: `user_metadata.role` se propaga en refresh de token (~1h); el RBAC de workspace sigue resolviéndose fresco desde DB vía `is_workspace_member()`. |
| **H8** | Membership queries en paralelo              | `is_workspace_member()` + lookup de plan ahora con `Promise.all` (2 round-trips secuenciales → 1 en wall-clock). **Decisión de double-check**: NO se reemplazó `is_workspace_member()` por un JOIN app-side — duplicaría la lógica SQL que es fuente de verdad de seguridad (RLS); el `membershipCache` 60s ya deduplica.                                                                                                                             |
| —      | `UserWithMeta` (audit.ts)                   | Widen a `AuthenticatedUser & {...}` — acepta tanto el usuario mínimo nuevo como el `User` completo legacy.                                                                                                                                                                                                                                                                                                                                            |

### Fase 4 — Dev experience local ✅

| #      | Cambio                                 | Detalle                                                                                                                                                                                                           |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H7** | `turbopackFileSystemCacheForDev: true` | `apps/erp/next.config.js` — caché de compilación persistente entre reinicios del dev server (Next 16). Producción no afectada.                                                                                    |
| **H7** | Script de exclusiones Defender         | `scripts/defender-exclusions.ps1` (con `-Revert`). Excluye `node_modules`, `.next`, `.turbo`, store pnpm del escaneo en tiempo real — requiere sesión admin. **NO ejecutado automáticamente**: el usuario decide. |
| —      | `graphify watch`                       | Ya aislado en `pnpm dev:graph` (script separado); no se toca el flujo por defecto.                                                                                                                                |

### Fase 5 — Opcional: NO ejecutada (por diseño)

El plan la condiciona a "solo si Fases 0–4 estables y con perfilado que lo justifique" (View Transitions, React Compiler annotation, migración a lucide-react). Quedan como trabajo futuro con su análisis de costo/beneficio en el plan.

---

## Verificación (gate final)

```
pnpm typecheck → 6/6 workspaces ✓ (tsc strict, zero any)
pnpm lint      → 6/6 workspaces ✓ (0 errors, 0 warnings)
pnpm test      → 39/39 tests ✓ (schema + router, Vitest 4.1.11)
pnpm build     → 5/5 tasks ✓ · 44 rutas · 39 en PPR (◐) · Middleware ✓
```

Incidencias resueltas durante el gate:

1. **Errores ESLint fantasma en 4 archivos** (customers/dashboard/layout/orders) — caché obsoleta de `.eslintcache` generada por el hook auto-lint mientras `server.ts` estuvo roto transitoriamente. Fix: borrar caché y re-lint. Verificado con `--no-cache` antes de borrar.
2. **`UserWithMeta` incompatibilidad** tras introducir `AuthenticatedUser` — widen estructural (ver Fase 3).
3. **3 casts innecesarios** en `trpc.ts` (157/287/312) — al tipar `user_metadata` como `UserMeta`, los casts `as UserMeta | undefined` sobraban; eliminados.

## Verificación puntual recomendada (manual, requiere dev server)

- **H1**: Network tab sin requests a `fonts.gstatic.com`; sin flash de ligaduras en recarga dura.
- **H2**: recarga dura con caché templada sin "Resolviendo workspace…".
- **H3**: en rutas migradas, datos visibles en el HTML inicial (View Source contiene el contenido).
- **H5**: logs server sin llamadas a `/auth/v1/user` por navegación (getClaims es local).
- **Precondición H5**: confirmar en Supabase Dashboard → Settings → JWT Keys que el proyecto usa claves asimétricas; con HS256 simétrico `getClaims()` degrada a red (degradación segura, sin error).

## Rollback

Por fase: `git checkout -- .` + `pnpm install` (patrón ya institucionalizado en este repo). Los cambios de esta sesión NO están commiteados.
