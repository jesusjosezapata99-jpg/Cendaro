# UI-REPORT — Identidad Visual Premium "Cendaro" (Plan v2) · Cierre de Fase Final

> **Plan fuente**: `~/.claude/plans/necesito-que-me-ayudes-hazy-thompson.md` (Plan v2 — Partes 1b–13 + Fase final)
> **Fecha**: 2026-09-12 · **Rama**: `performance` · **HEAD**: `b236f26` (+ cambios de esta sesión sin commit)
> **Estado**: ✅ Identidad premium completa y verificada (build, gates, smoke visual) · 🔴 **Hallazgo crítico de runtime abierto** (escrituras caídas, datos no visibles) — requiere decisión del usuario.

---

## 1. Resumen ejecutivo

- Las 13 partes del Plan v2 (más la Parte 14 POS del roadmap maestro) están implementadas. La sesión de Claude `d37b455b` se interrumpió en el paso 4 de la Fase final (este reporte + entrada en `state.md`); este documento cierra ese paso.
- Re-verificación completa el 2026-09-12: gate 12/12, tests 39/39, build 47/47 páginas, smoke de las 27 rutas `(app)` + estado not-found sin errores de página.
- Se cerraron **3 brechas reales de la Parte 4** que su plan marcaba como `[x]` pero no estaban completas en disco.
- Se detectó un **fallo crítico de runtime ajeno al UI**: todo `workspaceProcedure` falla en `SET LOCAL ROLE app_user` (HTTP 500) → todas las escrituras y 5 lecturas caídas, y el workspace se lee vacío. La evidencia apunta a un cambio en la conexión a BD el 2026-09-07 00:58 (§5).

---

## 2. Estado por parte (Plan v2 ↔ ejecución real)

La numeración del roadmap de Antigravity difiere de la del Plan v2; esta tabla las concilia.
`brain` = `C:/Users/jzs99/.gemini/antigravity-ide/brain/9c9b5a32-faed-43e9-97bf-5e5adb64877d/` · `assets` = `.opencode/reports/assets/ui-premium-2026-09/`

| Parte Plan v2 | Módulo                                                          | Ejecutado en                                                        | Evidencia visual                                                 |
| :------------ | :-------------------------------------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------- |
| 1b            | Identidad (Geist, glass, elevación, motion, charts) + Dashboard | Claude `d37b455b` (Track 7)                                         | `assets/parte1b-dashboard-{light,dark}.png` ¹                    |
| 2             | Catálogo                                                        | Claude `d37b455b`                                                   | `assets/parte2-catalog-{light,dark}.png` ¹                       |
| 3             | Inventario                                                      | Claude `d37b455b`                                                   | `assets/parte3-inventory-{light,dark}.png` ¹                     |
| 4             | Órdenes                                                         | Antigravity S99 + gate [h] Claude + cierre de brechas (esta sesión) | `brain/parte4-*` + `assets/parte4-orders-chips-{light,dark}.png` |
| 5             | Cotizaciones                                                    | Antigravity — `PLAN-2026-09-PARTE5-QUOTES-PREMIUM.md`               | `brain/parte5-*`                                                 |
| 6             | Pagos + Cierres                                                 | Antigravity — `PLAN-2026-09-PARTE6-PAYMENTS-CLOSURES.md`            | `brain/parte6-*`                                                 |
| 7             | CxC                                                             | Antigravity — `PLAN-2026-09-PARTE7-ACCOUNTS-RECEIVABLE.md`          | `brain/parte7-*`                                                 |
| 8             | Clientes                                                        | Antigravity — Roadmap Parte 10                                      | `brain/parte10-customer*`                                        |
| 9             | Tarifas + Precios                                               | Antigravity — `PLAN-2026-09-PARTE8-RATES-PRICING.md`                | `brain/parte8-*`                                                 |
| 10            | Contenedores                                                    | Antigravity — Roadmap Parte 9                                       | `brain/parte9-*`                                                 |
| 11            | Facturas + Notas                                                | Antigravity — Roadmap Parte 11                                      | `brain/parte11-*`                                                |
| 12            | Vendedores + Usuarios + Auditoría + Config                      | Antigravity — Roadmap Partes 10 y 13                                | `brain/parte10-vendors*`, `brain/parte13-*`                      |
| 13            | Alertas + WhatsApp + Marketplace + POS                          | Antigravity — Roadmap Partes 12, 13 y 14                            | `brain/parte12-*`, `brain/parte13-alerts*`, `brain/parte14-*`    |

¹ Recapturadas el 2026-09-12. Las originales se guardaron en `TEST/assets/ui-polish-2026-09/`, directorio que ya no existe.

---

## 3. Fase final — checklist

| Paso | Verificación                                 | Resultado                                                                                                                               |
| :--- | :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm exec turbo run typecheck lint --force` | ✅ 12/12 tareas, sin caché (33.6 s)                                                                                                     |
| 1    | `pnpm build`                                 | ✅ 5/5 tareas · compilado en 9.1 s · 47/47 páginas generadas                                                                            |
| 1    | `pnpm test`                                  | ✅ 39/39 (schema 36 + router 3)                                                                                                         |
| 2    | Smoke visual integral                        | ✅ 27 rutas `(app)` + `/orders/[id]` not-found: h1 correcto, 0 errores de página, 0 error boundaries · capturas claro/oscuro            |
| 2    | Vitals (2026-09-06)                          | CLS **0** en `/dashboard`, `/orders`, `/inventory`, `/catalog` · FCP 204–536 ms · TTFB 69–297 ms (agent-browser headless no expone LCP) |
| 3    | `graphify update .`                          | ✅ 11 448 nodos · 13 798 aristas                                                                                                        |
| 4    | Reporte + `state.md`                         | ✅ Este documento + Session 115                                                                                                         |
| 5    | Commit / push                                | ⏸ Pendiente de aprobación explícita del usuario                                                                                         |

---

## 4. Brechas de la Parte 4 cerradas en esta sesión

| #   | Archivo                                                 | Problema (verificado en disco)                                                                                                                                                                                              | Corrección                                                                                                                                                                                                                                                                                          |
| :-- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/erp/src/app/(app)/orders/client.tsx`              | Los chips de filtro cubrían 7 de 10 estados: faltaban `draft`, `pending_confirmation` y `returned` ("Devuelto" se podía asignar pero no filtrar).                                                                           | Chips derivados de `STATUS_CONFIG` (fuente única de verdad): 10 estados + "Todos".                                                                                                                                                                                                                  |
| 2   | `apps/erp/src/components/forms/update-order-status.tsx` | Con el pedido en un estado de entrada (`draft`/`pending_confirmation`), el select mostraba "Pendiente" mientras el estado interno era otro, y el botón quedaba bloqueado. Sin feedback de error. Estilo previo al rediseño. | El estado de entrada aparece como opción deshabilitada "(actual)"; el envío se tipa desde `TRANSITIONS` (sin cast); `toast.error` en `onError`; label asociado con `useId`/`htmlFor`; paridad visual con `UpdateQuoteStatusDialog` (`border-border-subtle`, `min-h-11`, Cancelar, `font-semibold`). |
| 3   | `apps/erp/src/app/(app)/orders/[id]/client.tsx`         | El icono de canal del encabezado era siempre `store`.                                                                                                                                                                       | Mapa `CHANNEL_ICONS` (el mismo de la lista).                                                                                                                                                                                                                                                        |

**Verificación**: `tsc --noEmit` (erp) ✓ · ESLint `--no-cache` ✓ · Prettier ✓ · navegador: 11 chips renderizados en ambos temas, 0 errores de página.
**Limitación**: el detalle con ítems y el diálogo de estado no se pudieron ejercitar visualmente, porque el único workspace se lee sin pedidos (ver §5). No se crearon datos de prueba en producción.

---

## 5. Hallazgos abiertos (requieren decisión del usuario)

### 🔴 C1 — Escrituras caídas: `SET LOCAL ROLE app_user` falla

**Síntoma**: todo procedimiento envuelto en `workspaceProcedure` (`packages/api/src/trpc.ts`) responde HTTP 500 con `Failed query: SET LOCAL ROLE app_user`. `workspaceReadProcedure` (sin transacción) no se ve afectado.

**Evidencia pasiva** (peticiones de la propia app durante el smoke, sin sondas):

| Petición                                             | Resultado                 | Página afectada        |
| :--------------------------------------------------- | :------------------------ | :--------------------- |
| `POST pricing.setRate` ×5 (auto-sync de la tasa BCV) | 500 — no se escribió nada | `/rates`               |
| `GET quotes.list` ×3                                 | 500                       | `/quotes`              |
| `GET vendor.listAR` ×3                               | 500                       | `/accounts-receivable` |
| `GET vendor.allCommissions` ×2                       | 500                       | `/vendors`             |
| `GET audit.list` ×3                                  | 500                       | `/audit`               |

**Alcance**: ~75 procedimientos. Incluye **todas las mutaciones** (crear pedido, cobro POS, pagos, cambios de estado, productos, tasas, importaciones) y estas lecturas: `quotes.list/byId`, `audit.list/byId`, `vendor.*`, `approvals.*`, `containers.byId`, `users.byId`, `inventoryImport.getWarehouseProducts`.

**Impacto de UX**: las páginas no muestran error; renderizan "0"/vacío mientras reintentan (fallo silencioso).

**Síntoma asociado**: el workspace `OmniCore Default` (el único) se lee con 0 productos, pedidos y cotizaciones. El 2026-09-07 a las 00:32, el POS mostraba 8 productos en ese mismo workspace (`brain/parte14-pos-terminal-dark.png`).

**Línea de tiempo**: `.env` se modificó el 2026-09-07 a las 00:58 (Session 113, configuración del token de Supabase), 26 min después de esa captura. `packages/db/src/client.ts` y `packages/api/src/trpc.ts` no cambian desde el 2026-09-04.

**Hipótesis principal (sin confirmar)**: `DATABASE_URL` conecta ahora con un rol distinto, lo que explicaría ambos síntomas:
(a) el rol queda sujeto a RLS, así que las tablas con RLS se leen vacías, mientras las 5 tablas base sin RLS (`workspace`, `user_profile`…) siguen respondiendo, que es exactamente lo observado;
(b) el rol no tiene permiso para `SET ROLE app_user`.
Si se confirma, **los datos no se perdieron** y la corrección es restaurar la cadena de conexión, sin DDL.

**Verificación propuesta** (una de las dos):

1. **Usuario**: abrir `.env` y comprobar que `DATABASE_URL` usa el session pooler (`…pooler.supabase.com:5432`) con el usuario `postgres.ljwoptpaxazqmnhdczsb`. Si no coincide, restaurarla desde Supabase Dashboard → Connect → Session pooler y reiniciar el dev server.
2. **Agente**: autorizar el diagnóstico de solo lectura ya preparado (`select current_user`, `pg_has_role(current_user, 'app_user', …)`, `SET LOCAL ROLE` dentro de una transacción revertida). El clasificador de permisos lo bloqueó en esta sesión.

Si el rol resultara correcto pero faltara el GRANT, la corrección sería DDL → protocolo 🔴 CRITICAL (doble confirmación).

### 🟠 C2 — Los errores de procedimientos no se registran en ningún log

`loggingMiddleware` hace `await next()` y espera una excepción, pero en tRPC `next()` **resuelve** `{ ok: false, error }`: los fallos se registran como `✓`, el `catch` es código muerto y `api/trpc/[...trpc]/route.ts` no define `onError` porque asume que el middleware ya los registra. Resultado: ningún error de procedimiento aparece en los logs, ni en desarrollo ni en producción. Por eso C1 pasó 5 días sin detectarse.

Corrección propuesta (≈10 líneas en `packages/api/src/trpc.ts`):

```ts
const result = await next();
const durationMs = Math.round(performance.now() - start);
if (!result.ok) {
  const code = result.error.code;
  const isClientError = [
    "UNAUTHORIZED",
    "FORBIDDEN",
    "BAD_REQUEST",
    "NOT_FOUND",
  ].includes(code);
  (isClientError ? reqLog.warn : reqLog.error)(
    `✗ ${path} [${code}]`,
    { durationMs, trpcCode: code },
    result.error,
  );
  return result;
}
```

Toca `packages/api` (fuera del alcance del Plan v2) → requiere aprobación.

### 🟡 C3 — Las líneas de pedidos y cotizaciones muestran `Prod #<uuid8>`

`sales.orderById` y `quotes.byId` devuelven filas crudas de `OrderItem`/`QuoteItem`. Resolver los nombres desde el cliente sería N+1 (`catalog.productById` carga 4 relaciones por producto). La corrección correcta es un `leftJoin(Product)` que devuelva `productName` y `sku` por línea; el UI mostraría nombre + SKU en mono. Requiere cambio de API (aprobación).

### ⚪ C4 — Estados de error silenciosos en el UI

Las páginas de lista tratan `isError` igual que "vacío". Recomendado: una variante de `EmptyState` con mensaje de error y botón "Reintentar" en el patrón compartido de listas. Conviene hacerlo después de C1.

### ⚪ Observación menor

En la primera carga tras un login sin cookie de workspace, el logger del contexto registra `workspaceId=null` en el prefetch SSR (camino previsto por H2). Con la cookie presente, el valor es correcto. Cosmético.

---

## 6. Archivos de esta sesión (sin commit)

- `apps/erp/src/app/(app)/orders/client.tsx`
- `apps/erp/src/app/(app)/orders/[id]/client.tsx`
- `apps/erp/src/components/forms/update-order-status.tsx`
- `.gemini/knowledge/state.md` (Session 115 + estado de salud)
- `.opencode/reports/UI-REPORT-2026-09-PREMIUM-IDENTITY.md` (este documento)
- `.opencode/reports/assets/ui-premium-2026-09/` (8 capturas)

## 7. Siguientes pasos recomendados (en orden)

1. **C1**: verificar `DATABASE_URL` o autorizar el diagnóstico de solo lectura.
2. **C2**: aprobar la corrección del logging, para que un fallo así no vuelva a pasar desapercibido.
3. Tras C1: verificar con datos reales el detalle de pedido con ítems, el diálogo de estado y el checkout del POS.
4. **C3** y **C4**.
5. Commit de esta sesión, cuando el usuario lo apruebe.
