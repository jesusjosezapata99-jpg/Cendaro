# Plan v2 — Parte 7: Cuentas por Cobrar (Accounts Receivable & Debt Aging)

> **Goal**: Elevar el módulo de Cuentas por Cobrar (`/accounts-receivable` y `/accounts-receivable/[id]`) al estándar **Cendaro Premium**: unificar tipografía Geist y `font-mono tabular-nums`, integrar tasa oficial BCV para saldos duales (USD / Bs), sustituir emojis por glifos oficiales del subset de 136 caracteres, resolver nombres reales de clientes mediante `sales.listCustomers`, implementar la calculadora de antigüedad de deuda (aging buckets), crear los modales interactivos `RecordArPaymentDialog` y `CreateArDialog`, y dotar a la vista de detalle de un layout quirúrgico con barra de progreso y trazabilidad de cobranza.
> **Status**: ✅ Completed & Verified — 2026-09-06

---

## 1. Baseline Audit & Technical State

### 1.1 Current Files & Issues

- **`apps/erp/src/app/(app)/accounts-receivable/client.tsx`**:
  - Utiliza emojis prohibidos (`💳`, `🚨`) y estilos ad-hoc con bordes simples.
  - La tabla muestra `Cliente ID` crudo (`ar.customerId.slice(0, 8)…`) en lugar del nombre real de la empresa o cliente y su RIF.
  - Carece de desglose dual en Bolívares (BCV oficial).
  - No cuenta con vista dual responsiva para dispositivos móviles (`md:hidden` con tarjetas táctiles $\ge 44\text{px}$).
  - No tiene botón para registrar abonos directamente ni para crear nuevas cuentas de crédito.
- **`apps/erp/src/app/(app)/accounts-receivable/[id]/client.tsx`**:
  - Diseño básico no adaptado al sistema de diseño Cendaro Premium.
  - No tiene desglose dual en Bs BCV en las KPI cards.
  - Carece de botón para registrar abonos sobre la cuenta abierta.
- **Backend Router & Schema Availability**:
  - En `packages/api/src/modules/vendors.ts`:
    - `vendor.listAR`: Consulta cuentas con filtros opcionales de cliente y estado (`arStatusEnum`).
    - `vendor.arById`: Consulta cuenta específica con `Customer.name` y `Customer.identification` ya joineados.
    - `vendor.recordPayment`: Registra abonos actualizando `paidAmount` y `balance`, transicionando automáticamente el estado a `paid` si el saldo es cero o `partial` si hubo abono.
    - `vendor.createAR`: Crea una nueva cuenta por cobrar asociada a un cliente y opcionalmente a un pedido.
    - `vendor.overdueAR`: Filtra cuentas en mora con fecha de vencimiento cumplida.
  - En `packages/api/src/modules/sales.ts`:
    - `sales.listCustomers`: Permite indexar y resolver nombres y RIF de clientes en tiempo real para la lista principal.

---

## 2. Surgical Implementation Steps

### Step 1: Modales Comerciales de Cobranza (Forms)

1. **`apps/erp/src/components/forms/record-ar-payment.tsx` (NEW)**:
   - Componente modal `RecordArPaymentDialog`.
   - Props: `open: boolean`, `onClose: () => void`, `receivable: { id: string; balance: number; customerName?: string }`.
   - Campo de monto numérico con paso 0.01 y botón de 1 clic "Abonar saldo total".
   - Cálculo en tiempo real del equivalente en Bolívares según tasa oficial BCV (`formatDualCurrency`).
   - Campo de notas / detalles del comprobante de abono.
   - Mutación tRPC `vendor.recordPayment` con invalidación de queries:
     - `[['vendor']]`
     - `[['sales']]`
     - `[['dashboard']]`
2. **`apps/erp/src/components/forms/create-ar.tsx` (NEW)**:
   - Componente modal `CreateArDialog`.
   - Props: `open: boolean`, `onClose: () => void`.
   - Selector de cliente (`sales.listCustomers`) con dropdown semántico.
   - Selector de orden opcional (`sales.listOrders`).
   - Monto total a financiar / crédito en USD con previsualización en Bs BCV.
   - Fecha de vencimiento (`dueDate`) con picker nativo estilizado.
   - Notas comerciales del crédito.
   - Mutación tRPC `vendor.createAR` con revalidación completa de queries.

### Step 2: Refactorización Lista Principal (`apps/erp/src/app/(app)/accounts-receivable/client.tsx`)

1. **Header Semántico y Acciones**:
   - `PageHeader` con título "Cuentas por Cobrar", descripción ejecutiva y botón "Nueva CxC" (`RoleGuard` para roles administrativos).
2. **KPI StatCards (4 Tarjetas de Alto Impacto)**:
   - **Cartera Total**: Saldo pendiente consolidado con desglose dual USD + Bs BCV. Tono `primary`, icono `receipt_long`.
   - **Cuentas Activas**: Conteo de expedientes vivos (`pending` + `partial`). Icono `assignment`.
   - **Cartera Vencida**: Monto total vencido con dual currency USD + Bs BCV. Tono `destructive`, icono `warning`.
   - **Tasa de Recuperación**: Porcentaje cobrado vs total otorgado (`font-mono tabular-nums`). Tono `success`, icono `check_circle`.
3. **Banda de Antigüedad de Deuda (Aging Buckets)**:
   - Visualizador de vencimientos segmentado:
     - Al día (0–30 días)
     - Mora Leve (31–60 días)
     - Mora Media (61–90 días)
     - Mora Crítica (> 90 días)
4. **Alerta Ejecutiva de Cartera Vencida**:
   - Banner semántico Cendaro (`border-destructive/30 bg-destructive/10 text-destructive`) visible sólo si hay cuentas vencidas, con conteo exacto, monto total en USD/Bs y filtro instantáneo de 1 clic.
5. **Filtros Deslizables (`mobile-scroll-x`)**:
   - Chips: Todos, Pendientes, Abono Parcial, Vencidas, Pagadas.
6. **Resolución de Nombres de Cliente**:
   - Mapeo reactivo mediante consulta a `sales.listCustomers` para mostrar nombre comercial y RIF en lugar de IDs UUID crudos.
7. **Vista Dual Responsiva**:
   - **Móvil (`md:hidden`)**: Tarjetas `.surface-card` con touch targets $\ge 44\text{px}$, badges semánticos, días de mora, botones "Abonar" y enlace al detalle.
   - **Desktop (`hidden md:block`)**: Tabla con celdas alineadas, headers en tracking amplio uppercase, cifras en `font-mono tabular-nums`, botón "Abonar" y acciones de navegación.

### Step 3: Refactorización Detalle CxC (`apps/erp/src/app/(app)/accounts-receivable/[id]/client.tsx`)

1. **Navegación Breadcrumb**:
   - Enlace `CxC > #{entry.id.slice(0, 8)}` con icono `chevron_right`.
2. **Header Card Ejecutiva**:
   - Razón social del cliente con link a `/customers/[customerId]`.
   - RIF / Cédula, enlace a la orden asociada `/orders/[orderId]` y badge de estado canónico (`StatusBadge`).
3. **KPIs de la Cuenta**:
   - Monto Original, Total Abonado, Saldo Restante y Días al Vencimiento / Días de Mora en `font-mono tabular-nums` y dual currency USD/Bs.
4. **Barra de Progreso de Cobro**:
   - Track `bg-primary/20` con relleno `bg-primary`, porcentaje calculado y etiquetas de montos base.
5. **Acciones Directas**:
   - Botón "Registrar Abono" (`RecordArPaymentDialog`).
   - Visualizador de notas del expediente.

---

## 3. Verification & Quality Gates

1. **TypeScript & ESLint**:
   - `pnpm --filter @cendaro/erp exec tsc --noEmit` -> Exit 0.
   - `pnpm typecheck` -> 6/6 paquetes exit 0.
   - `pnpm --filter @cendaro/erp lint` -> 0 errores, 0 warnings.
2. **Icon Subset Audit**:
   - 100% de los iconos verificados contra `apps/erp/src/app/fonts/material-symbols-subset.txt`.
   - Cero emojis en toda la interfaz.
3. **Cendaro Design Compliance**:
   - Tipografía Geist Sans / Geist Mono.
   - Todas las cifras en `font-mono tabular-nums`.
   - Dual currency USD/Bs con tasa oficial BCV (`useBcvRate`, `formatDualCurrency`).
   - Touch targets móviles $\ge 44\text{px}$ (`min-h-11`).
4. **Visual Evidence**:
   - Capturas en 1440x900 para `/accounts-receivable` y `/accounts-receivable/[id]` en temas light y dark.
5. **Living Memory & Graphify**:
   - Actualización de `.gemini/knowledge/state.md` con Session 102.
   - Ejecución de `graphify update .`.
