# PLAN-2026-09-PARTE4-ORDERS-PREMIUM — Pulido Quirúrgico e Interconexión Total de Órdenes

> **Created**: 2026-09-06  
> **Status**: ✅ Completed & Verified  
> **Author**: Antigravity IDE (Pair Programming)  
> **Scope**: `FEATURE` / `PERF` / `UX`  
> **Master Reference**: `Plan v2 - Identidad Visual Premium "Cendaro" (Partes 2-13)`

---

## 1. Resumen Ejecutivo y Diagnóstico

Este plan aborda la **finalización, robustecimiento e interconexión 10/10 de la Parte 4 (Órdenes de Venta)** del ERP Cendaro, tanto para la vista principal (`/orders`) como para la vista de detalle (`/orders/[id]`).

Tras la auditoría exhaustiva de la memoria de Claude, los commits previos (`c54bafd`, `e4c71e2`, `0c01728`) y la verificación empírica de TypeScript y ESLint (ambos pasando 6/6 verde), se identificaron las **3 oportunidades quirúrgicas** que separan el estado actual de un acabado nivel Linear/Apple de grado industrial:

1. **Brecha de Estados en Lista (`orders/client.tsx`)**:
   - `order_status` en `@cendaro/db/schema` declara **10 estados** (`draft`, `pending`, `pending_confirmation`, `confirmed`, `prepared`, `dispatched`, `delivered`, `invoiced`, `cancelled`, `returned`).
   - `orders/[id]/client.tsx` mapea los 10 estados, pero `orders/client.tsx` solo contenía 7 en `STATUS_CONFIG` y en su filtro de tipos. Si una orden está en `draft`, `pending_confirmation` o `invoiced`, el chip caía a texto crudo en inglés.
2. **Visualización de Líneas de Ítems en Detalle (`orders/[id]/client.tsx`)**:
   - El procedimiento tRPC `sales.orderById` retorna `{ ...order, items, payments }`.
   - Actualmente solo se renderiza la tabla de pagos (`payments`), omitiendo las líneas de pedido (`items`: cantidad, precio unitario, descuento, total de línea). Esto dejaba la pantalla de detalle incompleta en términos funcionales.
3. **Cierre de Verificación Visual y Capturas Browser**:
   - La sesión previa de Claude fue interrumpida por el toque de queda de API (403 `curfew_active`) justo cuando intentaba validar y capturar la vista de detalle en `agent-browser`.
   - Se debe completar la suite completa de capturas (lista light/dark, detalle light/dark, estado vacío not-found) con viewport 1440x900 y consola limpia de errores.

---

## 2. Restricciones No Negociables (Zero-Trust Guardrails)

- 🔒 **Packages API Intocable**: Prohibido alterar `packages/api/**` (la cuota y estabilidad del router tRPC deben preservarse).
- 🔒 **SSR Prefetch Intacto**: Prohibido modificar las firmas de `trpc/server.ts`, `trpc/query-client.ts`, o `export const instant = false;` en `page.tsx`.
- 🔒 **Subset Estricto de Iconos**: Todo icono utilizado debe pertenecer rigurosamente al subset de 136 glifos de `material-symbols-subset.txt`.
- 🔒 **Formato Numérico Estricto**: Toda cifra monetaria, cantidad, saldo, ID y fecha debe formatearse con `font-mono tabular-nums`.
- 🔒 **Aprobación Previa**: No se ejecuta ninguna modificación de código sin la aprobación explícita del usuario sobre este plan.

---

## 3. Cambios Propuestos

### Componente 1: `apps/erp/src/app/(app)/orders/client.tsx` (Lista de Órdenes)

- [x] **Unificación de `STATUS_CONFIG`**: Incorporar los 10 estados del enum `order_status`:
  - `draft` → "Borrador" (`neutral`)
  - `pending` → "Pendiente" (`warning`)
  - `pending_confirmation` → "Por Confirmar" (`warning`)
  - `confirmed` → "Confirmado" (`primary`)
  - `prepared` → "Preparado" (`primary`)
  - `dispatched` → "Despachado" (`primary`)
  - `delivered` → "Entregado" (`success`)
  - `invoiced` → "Facturado" (`primary`)
  - `cancelled` → "Anulado" (`destructive`)
  - `returned` → "Devuelto" (`neutral`)
- [x] **Filtros Expandidos**: Soportar los estados en el scroll horizontal móvil y la barra de filtros.
- [x] **Elevación y Superficies**: Mantener `.surface-card`, `border-border-subtle`, micro-animación `animate-in fade-in slide-in-from-bottom-1`.

### Componente 2: `apps/erp/src/app/(app)/orders/[id]/client.tsx` (Detalle de Orden)

- [x] **Sección de Líneas de Ítems (`order.items`)**:
  - Incorporar tabla semántica shadcn `<Table>` para las líneas de la orden cuando `order.items.length > 0`.
  - Columnas: Ítem / Ref, Cantidad, Precio Unitario, Descuento, Total Línea.
  - Tipografía `font-mono tabular-nums` para todas las columnas de cálculo.
  - Si `order.items` está vacío, renderizar un mensaje sutil o preservar el flujo limpio sin romper el layout.
- [x] **Interconexión de Navegación**:
  - Breadcrumb superior `Pedidos > {order.orderNumber}` con hover activo y transición fluida.
  - Botón de retorno en estado not-found (`search_off`) con `variant="outline"` redirigiendo a `/orders`.
  - Modal `UpdateOrderStatusDialog` sincronizado con revalidación de caché tRPC `[['sales']]`.
- [x] **Doble Moneda (USD / Bs)**:
  - Formateo consistente de Subtotal, Descuento, Total, Pagado y Saldo usando `formatDualCurrency` con la tasa oficial BCV.

### Componente 3: `apps/erp/src/components/forms/update-order-status.tsx` (Modal de Cambio de Estado)

- [x] **Alineación de Estados**: Asegurar que las opciones del `<select>` permitan los estados de transición válidos (`pending`, `confirmed`, `prepared`, `dispatched`, `delivered`, `invoiced`, `cancelled`, `returned`).

---

## 4. Matriz de Verificación y Criterios de Aceptación (Double Check)

| Paso    | Acción de Verificación             | Criterio de Éxito Binario                                                   |
| :------ | :--------------------------------- | :-------------------------------------------------------------------------- |
| **V1**  | Typecheck estricto del monorepo    | `pnpm typecheck` → Exit code 0 en 6/6 paquetes                              |
| **V2**  | Linter ESLint Flat Config          | `pnpm lint` → Exit code 0 en 6/6 paquetes                                   |
| **V3**  | Subset Material Symbols            | 0 iconos ausentes en `material-symbols-subset.txt`                          |
| **V4**  | Servidor de desarrollo Next.js     | `localhost:3000/orders` responde HTTP 200 sin errores 500                   |
| **V5**  | Captura lista modo claro           | `assets/ui-polish-2026-09/parte4-orders-light.png` válida                   |
| **V6**  | Captura lista modo oscuro          | `assets/ui-polish-2026-09/parte4-orders-dark.png` válida                    |
| **V7**  | Captura detalle modo claro         | `assets/ui-polish-2026-09/parte4-order-detail-light.png` generada           |
| **V8**  | Captura detalle modo oscuro        | `assets/ui-polish-2026-09/parte4-order-detail-dark.png` generada            |
| **V9**  | Prueba de ruta no encontrada       | `/orders/00000000-0000-4000-8000-000000000000` muestra EmptyState sin error |
| **V10** | Auditoría de consola del navegador | 0 excepciones JS no capturadas                                              |
