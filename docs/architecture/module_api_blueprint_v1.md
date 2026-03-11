# ERP Omnicanal — Módulos, API y Estructura de Implementación v1

## 1) Arquitectura de alto nivel

- Estilo: modular monolith
- Frontend: Next.js App Router
- Backend boundary: server actions + tRPC/route handlers para operaciones complejas
- DB: PostgreSQL + Drizzle ORM
- Jobs: cola para repricing, sync de Mercado Libre, alertas, reproyección de balances
- Observabilidad: logs estructurados, Sentry, auditoría append-only

## 2) Estructura de carpetas sugerida

```text
apps/
  web/
    app/
      (auth)/
      (dashboard)/
      api/
      globals.css
    src/
      modules/
        auth/
        catalog/
        inventory/
        receiving/
        pricing/
        sales/
        payments/
        receivables/
        vendors/
        integrations/
        reporting/
        audit/
      components/
      lib/
      server/
packages/
  db/
    schema/
    migrations/
    seeds/
  ui/
  config/
  validation/
```

## 3) Módulos funcionales

### 3.1 Auth & RBAC

Pantallas:

- login
- gestión de usuarios
- asignación de roles/permisos

Endpoints/actions:

- `auth.login`
- `users.list`
- `users.create`
- `users.update`
- `users.assignRole`
- `permissions.matrix`

### 3.2 Catalog

Pantallas:

- listado de productos
- detalle/edición de producto
- marcas
- categorías
- atributos técnicos
- equivalencias UOM

Endpoints/actions:

- `catalog.products.list`
- `catalog.products.get`
- `catalog.products.create`
- `catalog.products.update`
- `catalog.products.block`
- `catalog.categories.tree`
- `catalog.categories.create`
- `catalog.brands.list`
- `catalog.attributes.upsert`
- `catalog.equivalences.upsert`

### 3.3 Inventory

Pantallas:

- stock global
- stock por almacén
- stock por canal
- ledger de inventario
- conteos
- discrepancias y bloqueos
- transferencias internas

Endpoints/actions:

- `inventory.balances.list`
- `inventory.ledger.list`
- `inventory.transfer.create`
- `inventory.counts.create`
- `inventory.counts.submit`
- `inventory.discrepancies.list`
- `inventory.discrepancies.approve`
- `inventory.channelAllocation.update`

### 3.4 Receiving & Containers

Pantallas:

- listado de contenedores
- detalle de contenedor
- carga de packing list
- revisión importada
- recepción final

Endpoints/actions:

- `receiving.containers.list`
- `receiving.containers.create`
- `receiving.packingList.upload`
- `receiving.packingList.parse`
- `receiving.containerItems.matchProducts`
- `receiving.container.close`
- `receiving.container.approve`

### 3.5 Pricing & Exchange Rates

Pantallas:

- panel de tasas
- batch repricing
- historial de precios
- vista de margen

Endpoints/actions:

- `pricing.rates.list`
- `pricing.rates.upsert`
- `pricing.batch.generate`
- `pricing.batch.preview`
- `pricing.batch.approve`
- `pricing.history.list`
- `pricing.margins.summary`

### 3.6 Sales & Documents

Pantallas:

- POS / venta tienda
- pedidos
- cotizaciones
- notas de entrega
- facturas internas

Endpoints/actions:

- `sales.orders.create`
- `sales.orders.update`
- `sales.orders.confirm`
- `sales.orders.issueInvoice`
- `sales.orders.issueDeliveryNote`
- `sales.orders.cancel`
- `sales.quotes.create`
- `sales.documents.renderPdf`

### 3.7 Payments & Cash Closure

Pantallas:

- registro de pagos
- evidencias
- cierre diario de caja

Endpoints/actions:

- `payments.record`
- `payments.attachEvidence`
- `payments.listByOrder`
- `cashClosure.open`
- `cashClosure.summary`
- `cashClosure.close`

### 3.8 Accounts Receivable

Pantallas:

- cuentas por cobrar
- vencidos
- estado de cliente

Endpoints/actions:

- `receivables.list`
- `receivables.byCustomer`
- `receivables.createFromInvoice`
- `receivables.markPaid`
- `receivables.overrideBlock` (admin)

### 3.9 Vendor Portal

Pantallas:

- dashboard vendedor
- mis clientes
- mis pedidos
- mis cobros

Endpoints/actions:

- `vendor.orders.create`
- `vendor.orders.listMine`
- `vendor.customers.listMine`
- `vendor.receivables.listMine`
- `vendor.payments.registerInfo`

### 3.10 Mercado Libre

Pantallas:

- panel integración ML
- pedidos ML
- errores de sync
- estado de envíos

Endpoints/actions:

- `integrations.ml.accounts.get`
- `integrations.ml.orders.import`
- `integrations.ml.orders.list`
- `integrations.ml.orders.syncStatus`
- `integrations.ml.stock.push`
- `integrations.failures.list`

### 3.11 Reporting & Audit

Pantallas:

- dashboard owner/admin
- reportes exportables
- bitácora/auditoría
- alertas

Endpoints/actions:

- `reports.sales.summary`
- `reports.inventory.summary`
- `reports.receivables.summary`
- `reports.export.excel`
- `reports.export.pdf`
- `audit.logs.list`
- `alerts.list`
- `alerts.acknowledge`

## 4) Navegación sugerida por rol

### Dueño/Admin

- Dashboard
- Ventas
- Inventario
- Contenedores
- Pricing
- CXC
- Mercado Libre
- Reportes
- Auditoría
- Configuración

### Supervisor

- Dashboard operativo
- Ventas
- Inventario
- Contenedores
- Pricing
- Caja
- Alertas

### Empleado

- POS
- Pedidos
- Pagos
- Catálogo
- Stock

### Vendedor

- Mi dashboard
- Mis pedidos
- Mis clientes
- Mis cobros

### Marketing

- Catálogo
- Promos
- Métricas

## 5) Vertical slices recomendados

1. auth + permisos + shell dashboard
2. catálogo + categorías + marcas + atributos + equivalencias
3. almacenes + channels + balances + ledger
4. POS + pedidos + pagos + recibos
5. contenedores + packing list + recepción
6. tasas + repricing + price history
7. CXC + crédito
8. Mercado Libre sync
9. dashboards + exports + audit

## 6) Actions críticas con validaciones

- Cerrar venta -> validar stock suficiente, producto no bloqueado, total pagos exacto
- Mover stock entre canales -> rol supervisor/admin, generar approval/audit
- Cerrar contenedor -> approval supervisor/admin + posteo ledger
- Repricing batch -> guardar snapshot de tasas y price history
- Forzar venta con deuda -> solo admin, audit obligatorio
- Editar documento emitido -> solo admin, approval + audit obligatorio

## 7) Estados operativos clave

### Pedido

- draft
- pending_confirmation
- confirmed
- invoiced
- dispatched
- delivered
- cancelled

### Contenedor

- created
- in_transit
- received_total
- closed

### CXC

- open
- overdue
- paid
- blocked

## 8) Seeds mínimos

- roles base
- permisos base
- canales base
- almacenes base (`main`,`store`,`in_transit`,`reserved`,`defective`)
- marcas demo
- categorías demo
- usuario owner/admin inicial

## 9) Orden recomendado de implementación

- Semana 1–2: shell, auth, RBAC, db core
- Semana 3–4: catálogo + inventory core
- Semana 5–6: ventas + pagos + caja
- Semana 7–8: contenedores + receiving
- Semana 9–10: pricing + tasas + margins
- Semana 11–12: CXC + vendor portal + Mercado Libre base
- Semana 13+: dashboards, exports, hardening
