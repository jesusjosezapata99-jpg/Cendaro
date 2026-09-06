# PLAN-2026-09-PARTE6-PAYMENTS-CLOSURES — Pulido Quirúrgico, Registro de Cobranzas y Cierres de Caja Premium

> **Created**: 2026-09-06  
> **Status**: ✅ Completed & Verified  
> **Author**: Antigravity IDE (Pair Programming)  
> **Scope**: `FEATURE` / `UX` / `FINANCE` / `PERF`  
> **Master Reference**: `Plan v2 - Identidad Visual Premium "Cendaro" (Partes 2-13)`

---

## 1. Resumen Ejecutivo y Diagnóstico

Este plan aborda la **implementación completa, pulido de grado industrial e interconexión fluida 10/10 de la Parte 6 (Pagos y Cierres de Caja: `payments/`, `cash-closure/`)** de Cendaro ERP.

La auditoría forense de los módulos financieros reveló que:

1. **Módulo de Pagos (`apps/erp/src/app/(app)/payments/client.tsx`)**:
   - **Uso de Emojis prohibidos**: Renderiza `⚡` para Zelle (línea 39) y `✅` para estado validado (línea 253), violando la directiva de identidad de diseño y el subset tipográfico de Material Symbols.
   - **Estilos Ad-Hoc y Regresiones Visuales**: Utiliza clases arbitrarias sin componentes semánticos (`StatusBadge`, `StatCard`, `PageHeader`, `EmptyState`).
   - **Falta de Vista Móvil Dual**: Renderiza una tabla cruda sin tarjetas táctiles (`min-h-11`), generando desbordamiento horizontal en pantallas pequeñas.
   - **Inexistencia de Modal de Registro de Pago (`RegisterPaymentDialog`)**: No existe interfaz en UI para registrar un cobro vinculado a una orden de venta abierta, a pesar de que el backend ya implementa `sales.addPayment` y `payments.add`.
   - **Falta de Filtros por Método y Estado**: No cuenta con chips deslizantes (`mobile-scroll-x`) para filtrar rápidamente pagos validados, pendientes, o por método (Pago Móvil, Transferencia, POS, Efectivo, Zelle).
2. **Módulo de Cierres de Caja (`apps/erp/src/app/(app)/cash-closure/client.tsx`)**:
   - **Estilos Antiguos y Falta de Semántica**: Botones y tarjetas construidos manualmente con bordes de colores en lugar del sistema de elevación semántica Cendaro (`.surface-card`, `border-border-subtle`, `StatCard`).
   - **Falta de Filtro de Estados**: No permite filtrar entre cierres abiertos (`open`), cerrados (`closed`) y revisados (`reviewed`).
   - **Formulario de Cierre (`create-closure.tsx`) Rudimentario**:
     - No calcula dinámicamente la discrepancia en tiempo real mientras el usuario escribe el total real vs el total esperado.
     - Carece de conversión y desglose dual USD / Bs (BCV).
     - No utiliza `font-mono tabular-nums` en inputs monetarios.

---

## 2. Restricciones No Negociables (Zero-Trust Guardrails)

- 🔒 **Packages API & DB Intocables**: Prohibido alterar `packages/api/**` o `packages/db/**`. Se reutilizarán al 100% los routers tRPC existentes (`sales.listPayments`, `sales.addPayment`, `sales.validatePayment`, `sales.listClosures`, `sales.createClosure`, `sales.reviewClosure` / `payments.*`).
- 🔒 **SSR Prefetch Seguro**: Preservar `export const instant = false;`, `Suspense` con `<ListPageSkeleton />` para CLS ~ 0, y prefetch no bloqueante en Server Components (`page.tsx`).
- 🔒 **Subset Estricto de Iconos**: Todo icono debe pertenecer al subset de 136 glifos de `material-symbols-subset.txt` (ej. `payments`, `receipt_long`, `check_circle`, `pending`, `smartphone`, `account_balance`, `credit_card`, `bolt`, `contactless`, `warning`, `lock`, `lock_open`, `lock_clock`, `verified`, `point_of_sale`, `calendar_today`, `add`, `search`, `search_off`, `chevron_right`). **Cero emojis.**
- 🔒 **Cifras y Moneda**: Formato estricto `font-mono tabular-nums` en toda cifra, saldo, monto, discrepancia y fecha, con soporte de doble moneda USD / Bs oficial BCV vía `formatDualCurrency`.
- 🔒 **Touch Targets y Accesibilidad**: Mínimo `min-h-11` (44px) en todos los elementos interactivos móviles.
- 🔒 **Aprobación Previa del Usuario**: No se escribe código de producción sin la confirmación explícita del usuario sobre este plan.

---

## 3. Arquitectura y Componentes a Modificar / Crear

### Componente 1: `apps/erp/src/app/(app)/payments/client.tsx` (Lista de Pagos — Refactor Premium)

- **Header y Acciones**: Integrar `PageHeader` ("Pagos", "Registro y validación de cobros comerciales") y botón de acción principal `<Button onClick={() => setShowRegister(true)} className="min-h-11">` con icono `add` y modal `RegisterPaymentDialog` dinámico (`ssr: false`).
- **KPI StatCards**:
  1. _Total Cobrado_: Monto total recaudado en USD y Bs BCV (`icon="payments"`, `tone="primary"`).
  2. _Pagos Registrados_: Conteo total de transacciones (`icon="receipt_long"`, `tone="default"`).
  3. _Validados_: Conteo de cobros verificados (`icon="check_circle"`, `tone="success"`).
  4. _Por Validar_: Conteo de cobros pendientes (`icon="pending"`, `tone="warning"`).
- **Desglose de Métodos (Method Cards)**:
  - Mini tarjetas para los 5 métodos del schema:
    - Pago Móvil (`smartphone`)
    - Transferencia (`account_balance`)
    - Efectivo (`payments`)
    - Punto de Venta (`credit_card`)
    - Zelle (`bolt` — reemplazando emoji `⚡`)
  - Conteo de transacciones y total en USD + Bs BCV.
- **Filtros de Estado y Método**: Selector horizontal con scroll táctil (`mobile-scroll-x`):
  - "Todos", "Por Validar", "Validados", "Pago Móvil", "Transferencia", "Efectivo", "Punto de Venta", "Zelle".
- **Vista Móvil Dual (`md:hidden`)**: Tarjetas táctiles (`.surface-card`, `border-border-subtle`, `min-h-11`) con icono del método, monto en `font-mono tabular-nums` (USD + Bs), código de referencia, pagador, banco, fecha y botón de validación inmediata con optimistic UI.
- **Vista Desktop (`hidden md:block`)**: Tabla dentro de contenedor `.surface-card border-border-subtle rounded-xl overflow-hidden`.
  - Columnas: Método, Monto (USD + Bs en `font-mono tabular-nums`), Referencia, Pagador / Banco, Estado (`StatusBadge`), Fecha, Acciones.
- **Validación Optimista**: Mantener la mutación `validatePayment` con UI optimista y rollback en error, invalidando `[['payments']]` y `[['sales']]`.
- **EmptyState**: `<EmptyState icon="payments" title="No hay pagos registrados" description="..." />`.

### Componente 2: `apps/erp/src/components/forms/register-payment.tsx` (NUEVO Modal de Registro de Pago)

- Dialog dinámico para registrar cobros comerciales (`sales.addPayment` o `payments.add`).
- **Selector de Orden de Venta**:
  - Consulta `sales.listOrders` con pedidos que tengan saldo pendiente (`total - totalPaid > 0`).
  - Muestra el número de orden (`orderNumber`), canal comercial, monto total y saldo por cobrar.
  - Al seleccionar una orden, precarga automáticamente el saldo pendiente como monto sugerido.
- **Campos del Formulario**:
  - Método de pago (`paymentMethodEnum`: `mobile_payment`, `transfer`, `cash`, `pos_terminal`, `zelle`).
  - Monto a cobrar ($) con desglose automático a bolívares en tiempo real vía tasa BCV.
  - Referencia de pago (número de confirmación bancaria o voucher).
  - Nombre del banco emisor/receptor.
  - Nombre del pagador y Cédula/RIF (`payerName`, `payerIdDoc`).
  - Notas u observaciones adicionales.
- **Validación y Envío**:
  - Bloqueo si el monto es ≤ 0 o si no se ha seleccionado una orden.
  - Revalidación automática de `[['payments']]` y `[['sales']]` al guardar exitosamente.

### Componente 3: `apps/erp/src/app/(app)/cash-closure/client.tsx` (Cierres de Caja — Refactor Premium)

- **Header y Acciones**: Integrar `PageHeader` ("Cierre de Caja", "Arqueo de caja, conciliación diaria y control de discrepancias") y botón de acción principal `<Button onClick={() => setShowCreate(true)} className="min-h-11">` con icono `lock_clock` y modal `CreateClosureDialog`.
- **KPI StatCards**:
  1. _Ventas Hoy / Último Cierre_: Monto total vendido (`icon="payments"`, `tone="primary"`).
  2. _Efectivo Físico_: Total en caja física (`icon="payments"`, `tone="success"`).
  3. _Digital / Bancario_: Total ingresado por canales digitales (`icon="contactless"`, `tone="default"`).
  4. _Discrepancias Totales_: Discrepancia acumulada en USD/Bs (`icon="warning"`, `tone="destructive"` si != 0, else `success`).
- **Filtros de Estado**: Selector horizontal deslizante (`mobile-scroll-x`):
  - "Todos", "Abiertas" (`open`), "Cerradas" (`closed`), "Revisadas" (`reviewed`).
- **Vista Móvil Dual (`md:hidden`)**: Tarjetas táctiles con fecha de cierre en `font-mono tabular-nums`, `StatusBadge` semántico (`open` = `warning`, `closed` = `primary`, `reviewed` = `success`), cuadrícula compacta de 6 métricas financieras (Ventas, Efectivo, Digital, Esperado, Real, Discrepancia) y botón de acción de workflow (`Cerrar Caja`, `Revisar y Aprobar`).
- **Vista Desktop (`hidden md:block`)**: Tabla semántica con `.surface-card border-border-subtle rounded-xl overflow-hidden`.
  - Columnas: Fecha de Cierre, Estado, Total Ventas, Efectivo, Digital, Total Esperado, Total Real, Discrepancia (con formato semántico: verde si 0.00, rojo si negativa con signo "-", ámbar si positiva con signo "+"), Acciones.
- **Acciones de Workflow**:
  - Botón "Revisar y Aprobar" (`sales.reviewClosure`) protegido con `RoleGuard allow={["owner", "admin", "supervisor"]}`.
- **EmptyState**: `<EmptyState icon="point_of_sale" title="No hay cierres registrados" description="..." />`.

### Componente 4: `apps/erp/src/components/forms/create-closure.tsx` (Formulario de Cierre — Refactor Premium)

- **Campos Estructurados**:
  - Fecha de cierre (input tipo `date` con valor por defecto hoy).
  - Desglose de ingresos del día: Total Ventas, Total Efectivo, Total Digital.
  - Arqueo de caja: Total Esperado (del sistema) y Total Real (conteo físico en caja).
- **Calculadora Dinámica de Discrepancia**:
  - Al ingresar los totales real y esperado, calcula automáticamente en tiempo real:
    $$\text{Discrepancia} = \text{Total Real} - \text{Total Esperado}$$
  - Muestra un badge visual reactivo:
    - $0.00: Verde ("Caja Cuadrada")
    - < 0: Rojo ("Faltante en Caja: -$X.XX")
    - > 0: Ámbar ("Sobrante en Caja: +$X.XX")
- **Dual Currency**: Muestra el equivalente en Bs según tasa BCV activa en cada bloque de totales.
- **Notas**: Textarea para justificación de discrepancias o detalles del arqueo.
- **FormActions**: Con prop `submitting={create.isPending}` y botón "Registrar Cierre".

---

## 4. Matriz de Verificación Quirúrgica (Double Check)

| Paso   | Acción de Verificación      | Criterio de Éxito Binario                                                                     |
| :----- | :-------------------------- | :-------------------------------------------------------------------------------------------- |
| **V1** | Typecheck monorepo completo | `pnpm typecheck` → Exit code 0 en 6/6 paquetes                                                |
| **V2** | Linter ESLint Flat Config   | `pnpm lint` → Exit code 0 en 6/6 paquetes                                                     |
| **V3** | Auditoría de Iconos         | 100% de los glifos pertenecen al subset de 136 de `material-symbols-subset.txt`. Cero emojis. |
| **V4** | Tipografía y Moneda         | Toda cifra usa `font-mono tabular-nums` y desglose dual USD / Bs oficial BCV.                 |
| **V5** | Integridad SSR y CLS        | `export const instant = false;` activo, Suspense boundary con `ListPageSkeleton`, CLS ~ 0.    |
| **V6** | Evidencia Visual Browser    | Capturas a 1440x900 en light y dark mode para `/payments` y `/cash-closure`.                  |
| **V7** | Living Memory               | Entrada de sesión documentada en `.gemini/knowledge/state.md`.                                |
| **V8** | Knowledge Graph             | `graphify update .` ejecutado sin errores.                                                    |
