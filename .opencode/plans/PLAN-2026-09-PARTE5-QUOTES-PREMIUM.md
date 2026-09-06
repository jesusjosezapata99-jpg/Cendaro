# PLAN-2026-09-PARTE5-QUOTES-PREMIUM — Pulido Quirúrgico, Vista de Detalle e Interconexión Total de Cotizaciones

> **Created**: 2026-09-06  
> **Status**: ✅ Completed & Verified  
> **Author**: Antigravity IDE (Pair Programming)  
> **Scope**: `FEATURE` / `UX` / `PERF`  
> **Master Reference**: `Plan v2 - Identidad Visual Premium "Cendaro" (Partes 2-13)`

---

## 1. Resumen Ejecutivo y Diagnóstico

Este plan aborda la **implementación completa, pulido de grado industrial e interconexión fluida 10/10 de la Parte 5 (Cotizaciones / Quotes)** de Cendaro ERP.

La auditoría forense del módulo de cotizaciones reveló que:

1. **Vista de Lista Obsoleta (`quotes/client.tsx`)**:
   - Utiliza estilos antiguos ad-hoc (hardcoded `bg-slate-100`, `text-blue-600`), sin componentes semánticos del sistema (`StatusBadge`, `StatCard`, `PageHeader`, `EmptyState`).
   - Carece de diseño responsivo dual (en móvil renderiza una tabla cruda que desborda el viewport sin formato de tarjetas táctiles).
   - El botón "Nueva Cotización" está completamente inactivo (sin handler ni modal).
   - Los números carecen de `tabular-nums` y no respetan el estándar de tipografía monoespaciada de Geist Mono.
2. **Inexistencia de la Vista de Detalle (`quotes/[id]`)**:
   - A diferencia de Órdenes (`/orders/[id]`), Cotizaciones no posee la ruta `quotes/[id]`, impidiendo ver el desglose de productos cotizados, notas, validez y términos.
   - Sin embargo, **el backend ya cuenta con el router completo**: `quotes.byId`, `quotes.updateStatus` y `quotes.convertToOrder` ya están implementados y probados en `packages/api/src/modules/quotes.ts`.
3. **Falta de Interconexión Comercial Directa**:
   - No existe la acción de UI para **convertir una cotización en orden de venta** con 1 clic (`quotes.convertToOrder`), vinculando el ID de la orden generada (`convertedOrderId`) con la cotización.
   - No existe el modal de creación de cotización (`CreateQuoteDialog`) con selector de cliente, canal, validez y selector typeahead de productos con precios y descuentos.

---

## 2. Restricciones No Negociables (Zero-Trust Guardrails)

- 🔒 **Packages API & DB Intocables**: Prohibido alterar `packages/api/**` o `packages/db/**`. Todo el flujo se apoyará en los routers tRPC existentes (`quotes.list`, `quotes.byId`, `quotes.create`, `quotes.updateStatus`, `quotes.convertToOrder`).
- 🔒 **SSR Prefetch Seguro**: Preservar `export const instant = false;`, `Suspense` con skeletons reservados de altura (`ListPageSkeleton`, `DetailSkeleton`), y prefetch no bloqueante en Server Components (`page.tsx`).
- 🔒 **Subset Estricto de Iconos**: Todo icono utilizado debe pertenecer rigurosamente al subset de 136 glifos de `material-symbols-subset.txt` (ej. `request_quote`, `payments`, `check_circle`, `pending`, `store`, `search`, `search_off`, `add`, `edit`, `close`, `hourglass_top`, `chevron_right`, `receipt_long`, `flag`).
- 🔒 **Cifras y Moneda**: Formato estricto `font-mono tabular-nums` en toda cifra, precio, descuento, total y fecha, con soporte de doble moneda USD / Bs oficial BCV vía `formatDualCurrency`.
- 🔒 **Aprobación Previa del Usuario**: No se escribe código de producción sin la confirmación explícita del usuario sobre este plan.

---

## 3. Arquitectura y Componentes a Modificar / Crear

### Componente 1: `apps/erp/src/app/(app)/quotes/client.tsx` (Lista de Cotizaciones — Refactor Premium)

- **Header y Acciones**: Integrar `PageHeader` con título, descripción y botón de acción principal `<Button onClick={() => setShowCreate(true)} className="min-h-11">` con icono `add` y modal `CreateQuoteDialog` dinámico (`ssr: false`).
- **KPI StatCards**:
  1. _Cotizaciones_: Total de registros (`icon="request_quote"`).
  2. _Total Propuesto_: Monto total cotizado en USD y Bs BCV (`icon="payments"`, `tone="primary"`).
  3. _Aceptadas / Conv._: Conteo de cotizaciones aceptadas o convertidas (`icon="check_circle"`, `tone="success"`).
- **Filtros de Estado**: Selector horizontal con scroll táctil (`mobile-scroll-x`) con soporte para todos los estados de `quoteStatusEnum`:
  - `all` (Todos)
  - `draft` (Borrador — `neutral`)
  - `sent` (Enviada — `primary`)
  - `accepted` (Aceptada — `success`)
  - `rejected` (Rechazada — `destructive`)
  - `expired` (Expirada — `warning`)
  - `converted` (Convertida — `success`)
- **Consulta tRPC**: Pasar el filtro de estado al backend `trpc.quotes.list.queryOptions({ limit: 50, status: ... })`.
- **Vista Móvil Dual (`md:hidden`)**: Tarjetas interactivas táctiles (`min-h-11`, `.surface-card`, `border-border-subtle`, hover sutil) con enlace a `/quotes/[id]`, número de cotización en `text-primary font-mono font-semibold tabular-nums`, `StatusBadge`, desglose de monto en USD/Bs y fecha en `font-mono tabular-nums`.
- **Vista Desktop (`hidden md:block`)**: Tabla dentro de contenedor `.surface-card border-border-subtle rounded-xl overflow-hidden`.
  - Columnas: Cotización (link a `/quotes/[id]`), Canal (icono de canal), Estado (`StatusBadge`), Total (`font-mono tabular-nums`), Válida hasta (`font-mono tabular-nums`), Fecha de creación.
- **EmptyState**: `<EmptyState icon="request_quote" title="No se encontraron cotizaciones" description="..." />`.

### Componente 2: `apps/erp/src/app/(app)/quotes/[id]/page.tsx` & `client.tsx` (NUEVA Vista de Detalle)

- **`page.tsx` (Server Component)**:
  - Manejo asíncrono de parámetros Next.js 16 (`params: Promise<{ id: string }>`).
  - `export const instant = false;`
  - Suspense boundary con `<DetailSkeleton />` para CLS ~ 0.
  - Prefetch tRPC de `trpc.quotes.byId.queryOptions({ id })`.
- **`client.tsx` (Client Component)**:
  - Breadcrumb interactivo: `Cotizaciones > {quote.quoteNumber}`.
  - Barra de acciones:
    - Botón "Cambiar Estado" (`UpdateQuoteStatusDialog`).
    - Botón de conversión rápida: **"Convertir en Pedido"** (disponible cuando la cotización no esté cancelada ni ya convertida). Invocación con confirmación a `quotes.convertToOrder`, revalidación de caché `[['quotes']]` y `[['sales']]`, y redirección a `/orders/${order.id}`.
    - Indicador de orden vinculada: Si `quote.status === "converted"` y `quote.convertedOrderId` existe, muestra un botón directo para abrir la orden asociada (`/orders/${quote.convertedOrderId}`).
  - Header Card: Número, StatusBadge, canal de venta con icono, fecha de emisión, fecha de expiración/validez.
  - 4 StatCards métricas: Total (`tone="primary"`), Subtotal, Descuento (`tone="warning"`), Estado.
  - Sección de Notas / Términos de la cotización.
  - **Tabla de Productos Cotizados (`quote.items`)**:
    - Tabla semántica `<Table>` con headers en uppercase espaciado.
    - Columnas: Ítem / Ref, Cantidad, Precio Unitario, Descuento, Total Línea.
    - Cifras en `font-mono tabular-nums`.
  - Estado Not Found limpio con `EmptyState` (`search_off`) y botón outline para volver a `/quotes`.

### Componente 3: `apps/erp/src/components/forms/create-quote.tsx` (NUEVO Modal de Creación)

- Dialog dinámico con selector de cliente (`sales.listCustomers`), canal comercial (`store`, `vendors`, `mercadolibre`, `whatsapp`, `instagram`), selector de validez (días o fecha), y campo de notas.
- Buscador typeahead de productos (`catalog.listProducts`) por SKU, nombre o código de barras, con selector de cantidad, precio unitario y descuento.
- Resumen en tiempo real del Subtotal, Descuento y Total en USD y Bs (BCV).
- Mutación `quotes.create` con invalidación de caché tRPC `[['quotes']]`.

### Componente 4: `apps/erp/src/components/forms/update-quote-status.tsx` (NUEVO Modal de Estado)

- Dialog para cambiar el estado de la cotización a cualquiera de los 6 estados de `quote_status` (`draft`, `sent`, `accepted`, `rejected`, `expired`, `converted`).
- Mutación `quotes.updateStatus` con revalidación de caché tRPC `[['quotes']]`.

---

## 4. Matriz de Verificación Quirúrgica (Double Check)

| Paso    | Acción de Verificación                  | Criterio de Éxito Binario                                                           |
| :------ | :-------------------------------------- | :---------------------------------------------------------------------------------- |
| **V1**  | Typecheck monorepo completo             | `pnpm typecheck` → Exit code 0 en 6/6 paquetes                                      |
| **V2**  | Linter ESLint Flat Config               | `pnpm lint` → Exit code 0 en 6/6 paquetes                                           |
| **V3**  | Auditoría glifos Material Symbols       | 100% de iconos dentro del subset de 136 glifos                                      |
| **V4**  | Servidor de desarrollo Next.js          | `GET /quotes` responde HTTP 200 sin excepciones de consola                          |
| **V5**  | Ruta de detalle Next.js                 | `GET /quotes/00000000-0000-4000-8000-000000000000` responde HTTP 200 con EmptyState |
| **V6**  | Captura lista modo claro (1440x900)     | `assets/ui-polish-2026-09/parte5-quotes-light.png`                                  |
| **V7**  | Captura lista modo oscuro (1440x900)    | `assets/ui-polish-2026-09/parte5-quotes-dark.png`                                   |
| **V8**  | Captura detalle modo claro (1440x900)   | `assets/ui-polish-2026-09/parte5-quote-detail-light.png`                            |
| **V9**  | Captura detalle modo oscuro (1440x900)  | `assets/ui-polish-2026-09/parte5-quote-detail-dark.png`                             |
| **V10** | Actualización del grafo de conocimiento | `graphify update .` exit code 0                                                     |
