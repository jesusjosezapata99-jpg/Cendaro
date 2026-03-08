# PRD (semi-hecho) — Plataforma ERP Comercial Omnicanal para Mayorista / Retail

## Estado del documento
- **Versión:** 0.7 (semi-hecho)
- **Audiencia primaria:** Claude Code Opus 4.6 Thinking / Anti-Gravity / equipo técnico
- **Idioma operativo:** Español
- **Objetivo del documento:** convertir el discovery ya levantado en una especificación funcional y técnica suficientemente clara para iniciar arquitectura, UI system, dominio y backlog.

---

## 1) Resumen ejecutivo

Se requiere construir una **plataforma web comercial omnicanal** para una empresa mayorista y retail con operación central en Caracas, Venezuela, ventas nacionales y más de **5.000 referencias**, con crecimiento proyectado acelerado. La plataforma debe resolver principalmente:

1. **Descontrol de inventario** entre tienda, almacenes, vendedores y canales online.
2. **Falta de trazabilidad de ventas** por canal, empleado, vendedor, cliente y documento emitido.
3. **Carga compleja de contenedores/importaciones** con packing lists extensos y gran volumen de referencias.
4. **Actualización manual y lenta de precios** atados al contexto cambiario venezolano.
5. **Falta de un panel gerencial central** con visión real de ventas, margen, stock, alertas y operación.

El sistema debe operar como **fuente maestra de verdad comercial** para catálogo, inventario, movimientos, precios internos, ventas internas, pedidos de vendedores, compras/importaciones, cuentas por cobrar y control operativo. Mercado Libre y WhatsApp se consideran **canales conectados**, no la fuente de verdad.

---

## 2) Nombre funcional recomendado del producto

### Opción principal
**ERP Comercial Omnicanal para Mayorista y Retail**

### Definición técnica
**OMS + IMS + WMS Ligero + Pricing Engine + Sales Portal + Accounts Receivable + Marketplace Connector**

---

## 3) Contexto del negocio

### 3.1 Tipo de negocio
- Una sola empresa legal.
- Varias marcas bajo el mismo núcleo empresarial.
- Operación principal en Caracas.
- Venta nacional en Venezuela.
- Venta híbrida: **mayorista + detal**.

### 3.2 Distribución aproximada de ventas
- **Tienda física:** 60%
- **Vendedores nacionales:** 20%
- **Mercado Libre:** 15%
- **WhatsApp / Instagram / otros:** 5%

### 3.3 Naturaleza del catálogo
Catálogo heterogéneo tipo quincallería / multi-rubro, incluyendo:
- electrónica
- maquinaria
- maquillaje
- ferretería
- hogar
- fiesta
- playa
- adulto
- accesorios y otros

### 3.4 Escala de catálogo
- Estado actual: **5.000+ SKU/referencias**
- Proyección: fuerte crecimiento en 3–6 meses

---

## 4) Problemas principales a resolver

### P0 — Control de inventario
- Recuentos frecuentes por diferencias operativas.
- Ventas o salidas no reflejadas correctamente.
- Dificultad para saber dónde está realmente el stock.
- Problemas cuando entra mercancía nueva de referencias ya existentes.

### P0 — Trazabilidad comercial
- Necesidad de saber exactamente:
  - qué se vendió
  - dónde se vendió
  - por qué canal
  - qué empleado lo procesó
  - qué vendedor originó la venta
  - a nombre de qué cliente/empresa se emitió la factura interna

### P0 — Recepción de contenedores
- Llegan contenedores high cube con gran volumen y miles de unidades.
- Packing list con mucha complejidad.
- Necesidad de comparar lo esperado con lo recibido.
- Necesidad de manejar mercancía en tránsito / standby antes de liberar stock.

### P0 — Pricing dinámico
- Los precios hoy se ajustan manualmente.
- La realidad venezolana exige reaccionar a BCV y manejo interno de referencia paralela.
- Se requiere motor masivo de repricing, no edición producto por producto.

### P1 — Gestión gerencial
- Falta un panel maestro con KPIs, alertas, ventas, márgenes, stock y cuentas por cobrar.

---

## 5) Objetivos de negocio

### A 3–6 meses
1. Reducir diferencias de inventario.
2. Tener trazabilidad completa de ventas por canal/persona/documento.
3. Disminuir tiempo operativo de carga de contenedores y actualización de productos.
4. Automatizar actualización de precios por tasas.
5. Dar visibilidad ejecutiva al dueño y a supervisión.

### Objetivos funcionales
- Mantener inventario confiable y bloqueado ante inconsistencias.
- Centralizar operación comercial.
- Permitir decisiones rápidas sobre margen, pricing y reposición.
- Facilitar el trabajo de vendedores y empleados con interfaces simples y rápidas.

---

## 6) No-objetivos actuales / fuera de alcance inicial
- Multiempresa.
- Multisucursal compleja.
- Facturación fiscal integrada dentro del sistema principal.
- Devoluciones/consignación como flujo prioritario.
- Microservicios distribuidos desde el día 1.
- Marketplace múltiple más allá de Mercado Libre (fase posterior).

---

## 7) Usuarios y roles

### 7.1 Roles base
1. **Dueño / Admin maestro**
2. **Gerente**
3. **Supervisor**
4. **Empleado de tienda / operación**
5. **Vendedor nacional**
6. **Marketing**

### 7.2 Principios de autorización
- Acceso por rol.
- Acceso por módulo.
- Acceso por acción.
- Acceso por datos propios vs globales.
- Acceso configurable por el admin.

### 7.3 Reglas base por rol

#### Dueño / Admin
Acceso total a:
- dashboard ejecutivo completo
- inventario y ajustes
- distribución de stock por canal
- aprobación de recepción de contenedores
- aprobación de cambios de precio
- aprobación de crédito
- reportes globales
- visibilidad de todos los vendedores, pedidos, clientes, cobranzas y pagos

#### Supervisor
Acceso operativo ampliado a:
- validación de llegada/carga de inventario
- movimientos entre canales
- validación operativa de ciertos procesos
- cierre de caja diario
- revisión de pedidos
- alertas operativas

#### Empleado
Acceso restringido a:
- ventas
- consulta de inventario permitido
- consulta de precios de venta
- emisión de documentos internos permitidos
- registro de pagos
- búsqueda de productos

No puede:
- cambiar precios
- ver ventas globales
- ver pedidos de otros vendedores
- ver costos

#### Vendedor nacional
Acceso solo a:
- su dashboard
- sus clientes
- sus pedidos
- su cartera
- su stock visible del canal vendedor
- estado de sus pedidos/facturas/cobros

No puede:
- ver ventas de tienda
- ver pedidos de otros vendedores
- editar precios
- facturar directamente

#### Marketing
Acceso orientado a:
- promociones
- campañas
- vistas comerciales limitadas
- productos y rendimiento de campañas (definición posterior)

---

## 8) Módulos del sistema

### M1. Autenticación y autorización (RBAC)
### M2. Catálogo de productos
### M3. Inventario multialmacén y multicanal
### M4. Compras e importaciones / contenedores
### M5. Pricing engine y tablero de tasas
### M6. Ventas internas tienda / online asistido
### M7. Portal de vendedores nacionales
### M8. Cuentas por cobrar y crédito
### M9. Pagos y cierre diario de caja
### M10. Integración Mercado Libre
### M11. Integración WhatsApp (flujo híbrido manual-asistido)
### M12. Dashboard gerencial y reportes
### M13. Alertas y auditoría operativa

---

## 9) Modelo operativo de inventario

### 9.1 Concepto de stock
Debe existir:

1. **Stock general maestro**
2. **Stock por canal / asignación operativa**
   - tienda física
   - Mercado Libre
   - vendedores nacionales (pool compartido del canal, no por vendedor individual)
   - WhatsApp (usa stock tienda)
   - Instagram (usa stock tienda)

### 9.2 Regla de stock por canales
- WhatsApp e Instagram **no tienen stock propio independiente**.
- Ambos consumen stock asignado a tienda.
- Mercado Libre sí requiere stock asignado/controlado y sincronizado.
- Vendedores nacionales operan sobre un **stock visible del canal vendedores**, entendido como bolsa compartida del canal.

### 9.3 Distribución inicial de nuevo inventario
Cuando entra nueva mercancía, el reparto inicial del stock se hace **manual** por:
- admin
- supervisor

### 9.4 Movimiento entre canales
Se debe permitir mover stock entre canales, por ejemplo:
- de Mercado Libre a tienda
- de canal vendedores a tienda
- de tienda a Mercado Libre

Solo pueden hacerlo:
- admin
- supervisor

### 9.5 Regla de bloqueo
- No se permite venta con stock negativo.
- Si un producto presenta diferencia de inventario crítica, el producto queda **bloqueado para la venta** hasta revisión y desbloqueo autorizado.
- Estado sugerido: `inventory_locked`.

### 9.6 Inventario físico y ubicaciones
La plataforma debe soportar múltiples almacenes/ubicaciones físicas:
- tienda / exhibición
- almacén piso 1
- otro almacén externo
- stock en tránsito / standby
- stock reservado / emergencia
- stock defectuoso (baja prioridad funcional)

También debe soportar ubicación granular opcional:
- pasillo
- estante
- rack
- caja / pallet

### 9.7 Conteos cíclicos
Debe contemplarse conteo cada 15 días o mensual, configurable.

---

## 10) Catálogo de productos

### 10.1 Campos base obligatorios
Cada producto debe poder almacenar como mínimo:
- código interno
- código de barras
- nombre
- categoría
- marca
- proveedor principal
- precio tienda
- precio mayor
- precio detal
- precio vendedor nacional
- precio promo online
- precio especial (si aplica a operación)
- imagen principal
- peso
- volumen
- compatibilidad
- descripción corta
- descripción larga
- atributos técnicos dinámicos

### 10.2 Atributos dinámicos por categoría
El catálogo debe soportar atributos por categoría, por ejemplo:
- voltaje
- potencia / watts
- material
- color
- tamaño
- capacidad
- compatibilidad
- garantía/sanidad si aplica
- presentación
- uso recomendado

### 10.3 Estructura de variantes
**Pendiente de definición final.**
Por ahora el PRD deja abierta la decisión entre:
- producto padre + variantes hijas
- o cada variante como SKU independiente

Debe soportar como mínimo variaciones comunes:
- color
- potencia
- tamaño
- presentación
- modelo

### 10.4 Creación obligatoria de ficha
Si una referencia nueva entra por contenedor y no existe:
- debe crearse ficha completa antes de liberarse a inventario real
- la categoría debe asignarse obligatoriamente
- el código de barras debe capturarse si existe
- la imagen debe ser obligatoria a nivel de dato operativo objetivo, aunque su carga pueda quedar diferida por flujo controlado

---

## 11) Costeo y margen

### 11.1 Estado actual
El negocio hoy opera de manera manual con incrementos empíricos de aprox. 50% a 110% sobre referencia de costo.

### 11.2 Decisión actual
El método contable/costeador completo **queda pendiente**.

### 11.3 Regla operativa aprobada para esta fase
Si entra mercancía del mismo producto con costo diferente:
- el sistema debe recalcular un **costo promedio operativo**
- objetivo: no sobre-reaccionar ni al alza ni a la baja con una sola importación

### 11.4 Margen
El dashboard debe calcular margen sobre **costo promedio actual**.

### 11.5 Vistas de margen mínimas
- margen por producto
- margen por vendedor

---

## 12) Pricing engine y tablero de tasas

### 12.1 Tipos de precio requeridos
El sistema debe soportar, como mínimo:
- precio tienda
- precio mayor
- precio vendedor nacional
- precio promo online
- precio especial manual (si aplica)

### 12.2 Reglas generales
- Los empleados **no** pueden editar precios.
- Admin y supervisor deben tener un **panel de tasas y pricing**.
- Debe existir recalculo masivo, nunca depender de edición uno por uno.

### 12.3 Tabla de tasas administrativa
Solo admin y supervisor deben ver/editar una tabla centralizada con:
- tasa BCV
- tasa paralela de referencia interna
- tasa RMB/CNY ↔ USD y/o RMB/CNY ↔ Bs si se decide derivar

### 12.4 Reglas del motor de repricing
#### Regla principal confirmada
- Si la tasa BCV sube **5% o más**, los precios se **actualizan automáticamente de inmediato**.
- Simultáneamente se genera una **alerta al admin**.
- El admin debe revisar/aprobar/ajustar dentro de una ventana de **24 horas**.
- Si sube 10% o más, aplica la misma lógica; el umbral efectivo ya quedó fijado en **>= 5%**.

### 12.5 Comportamiento durante la ventana de 24 horas
- Los **precios nuevos ya quedan publicados/activos**.
- La aprobación del admin del día siguiente sirve para:
  - ratificar
  - recalcular
  - ajustar manualmente si conviene
  - revisar si el mercado/tasa cambió otra vez

### 12.6 Reglas manuales desde panel
Si admin/supervisor modifican en la tabla:
- BCV
- paralela
- RMB

entonces el motor debe:
1. recalcular precios elegibles
2. aplicar reglas configuradas
3. generar bitácora del cambio
4. alertar que hubo repricing masivo

### 12.7 Calculadora integrada
Debe existir una calculadora administrativa para:
- RMB → USD
- USD → Bs
- RMB → Bs (directo o derivado)
- estimación rápida de precio sugerido

### 12.8 Bitácora de precios
Cada cambio de precio debe guardar:
- precio anterior
- precio nuevo
- tasa usada
- fecha/hora
- disparador (auto/manual)
- usuario responsable si hubo ajuste humano
- motivo / observación opcional

### 12.9 Fórmula objetivo del pricing
Debe poder incorporar, al menos:
- costo origen China
- flete
- gastos
- importación/nacionalización
- impuesto
- comisión
- margen objetivo
- redondeo si en el futuro se requiere

**La fórmula final exacta queda como pendiente de calibración del negocio.**

---

## 13) Compras, contenedores e importación

### 13.1 Documentos de origen
El sistema debe aceptar carga previa del contenedor mediante:
- CSV
- Excel
- PDF

### 13.2 Caso real de negocio
- El packing list suele venir en chino.
- Se desea asistencia de IA para extraer/normalizar datos antes de la llegada física.

### 13.3 Flujo de contenedor
1. Cargar packing list antes de arribo.
2. Crear contenedor en sistema.
3. Dejar productos en estado **standby / tránsito**.
4. Mantener visibilidad durante 60–90 días de tránsito.
5. Al llegar, ejecutar recepción física y conciliación.
6. Validar recepción final.
7. Solo admin libera el stock a inventario real.
8. Luego admin/supervisor distribuyen stock a canales.

### 13.4 Estados mínimos del contenedor
- creado
- embarcado / en tránsito
- recibido total
- cerrado

### 13.5 Datos mínimos del contenedor
- número de contenedor
- fecha salida
- fecha llegada
- costo FOB
- proveedor / origen (recomendado)
- observaciones

### 13.6 Historial de importación
Debe existir historial para analizar:
- qué productos entraron por lote/importación
- qué costo operativo tuvieron
- qué productos rotan más
- qué conviene recomprar

### 13.7 Aprobación de cierre
La recepción final y liberación del stock la aprueba solo **admin**.

---

## 14) Ventas: canales y flujos

### 14.1 Canales de venta existentes
- tienda / mostrador
- mayorista
- vendedor en ruta / nacional
- online asistido
- Mercado Libre
- WhatsApp
- Instagram
- Facebook

### 14.2 Venta omnicanal híbrida
Una venta puede empezar en un canal y cerrarse en otro, por ejemplo:
- Instagram → WhatsApp → pago → despacho

### 14.3 Estados del pedido
- pendiente
- confirmado
- preparado
- despachado
- entregado
- anulado
- devuelto (si fase posterior lo requiere)

---

## 15) Flujo de venta en tienda

### 15.1 Flujo base
1. Empleado agrega productos por escáner o buscador.
2. Ajusta cantidades.
3. Sistema calcula importe total.
4. Se registra el/los métodos de pago.
5. El total pagado debe coincidir exactamente con el total de la venta.
6. Si el cliente requiere factura interna con datos, se solicitan.
7. Si no requiere datos formales, la venta puede cerrarse sin registro completo del cliente.
8. Se emite documento interno correspondiente.
9. Se descuenta inventario.
10. La venta queda atribuida al empleado autenticado que la cerró.

### 15.2 Reglas
- El empleado no puede editar precio.
- La venta puede existir sin cliente formal completo.
- Si cambia el operador/empleado, debe autenticarse con su propio perfil antes de emitir/cerrar.
- No se puede cerrar factura/venta sin registrar el/los medios de pago y sus referencias cuando apliquen.

---

## 16) Portal de vendedor nacional

### 16.1 Flujo base
1. El vendedor entra a su portal.
2. Ve catálogo, stock del canal vendedor y sus clientes.
3. Crea pedido/lista de productos.
4. Envía pedido al equipo interno.
5. Empleado/admin/supervisor revisa y factura internamente.
6. El vendedor no factura directamente.

### 16.2 Reglas
- Un pedido no tiene más de un vendedor nacional.
- Debe existir trazabilidad de quién originó la venta y quién emitió la factura interna.
- El vendedor solo ve su información y su cartera.
- El vendedor puede consultar sus cuentas por cobrar / estado de clientes (nivel exacto pendiente de cierre).

### 16.3 Crédito
Clientes de vendedores pueden comprar a crédito con plazo aprox. 10–15 días hábiles.

Aprobación de crédito:
- solo admin

---

## 17) Clientes y cuentas por cobrar

### 17.1 Tipos de cliente
- mayorista
- detal
- distribuidor
- VIP
- marketplace
- cliente de vendedor

### 17.2 Campos recomendados
- nombre / razón social
- identificación / RIF / cédula
- teléfonos
- direcciones
- vendedor asignado
- límite de crédito
- días de crédito
- saldo
- deuda vencida
- historial de compras

### 17.3 CxC
Debe existir módulo de cuentas por cobrar para:
- ventas a crédito
- saldo pendiente
- abonos
- antigüedad de deuda
- alertas por vencimiento
- bloqueo/reglas comerciales futuras

---

## 18) Documentos del sistema

### MVP documental confirmado
- cotización
- pedido
- nota de entrega
- factura interna (no fiscal)
- recibo de pago
- nota de crédito

### Factura fiscal
- Se emite en sistema externo.
- El ERP no la genera ni integra en fase inicial.

### Numeración
- Debe existir numeración automática por tipo documental.

### Nota de crédito
- Se mantiene en el PRD como documento soportado.
- Su flujo exacto y su relación con devolución física quedan para definición posterior.

---

## 19) Pagos y caja

### 19.1 Medios de pago soportados
- pago móvil
- transferencia
- efectivo
- Zelle / similares si se habilitan (pendiente)
- punto de venta
- métodos mixtos en una misma transacción

### 19.2 Regla crítica
La venta solo puede cerrarse si la suma de los métodos de pago registrados coincide exactamente con el total de la venta.

### 19.3 Datos por método
Ejemplos:
- **Pago móvil:** referencia, nombre, cédula, monto, hora
- **Transferencia:** referencia, monto, banco, hora
- **Efectivo:** monto, hora
- **Punto de venta:** número de operación/voucher, monto, hora

### 19.4 Evidencias
Se pueden adjuntar varias imágenes/comprobantes por pago.

### 19.5 Validación de pagos
Pueden validar pagos:
- admin
- supervisor
- empleado

### 19.6 Caja
- Debe existir cierre diario de caja.
- El sistema debe permitir análisis del día para detectar errores o discrepancias.

---

## 20) Integración Mercado Libre

### Requerimientos confirmados
- importar pedidos
- actualizar stock
- registrar venta final
- descontar inventario automáticamente
- consultar estado de envío
- alertar fallas de integración al admin
- panel específico de control de Mercado Libre

### Reglas
- Hay una sola cuenta principal.
- Publicación por artículo.
- El descuento de stock debe ocurrir **en tiempo real**.
- Si falla integración, alertar al admin y dejar trazabilidad del incidente.

---

## 21) Integración WhatsApp

### Modelo funcional
- Canal híbrido comercial/venta asistida.
- Las ventas se registran manualmente por el equipo.
- No se requiere catálogo completo automatizado dentro de WhatsApp para esta fase.
- Sí se consideran mensajes automáticos como fase útil/posible.

### Reglas
- WhatsApp consume stock tienda.
- La operación debe ser ligera, no recargar al equipo con demasiados pasos.

---

## 22) Dashboard del dueño / gerencia

### Objetivo
Dar visibilidad ejecutiva y operativa ampliada, no un tablero rígido mínimo.

### KPIs/Widgets deseados
- ventas del día
- ventas de ayer
- ventas de la semana
- ventas por canal
- ventas por vendedor
- margen
- productos más vendidos
- productos sin movimiento
- stock bajo
- diferencias de inventario
- pedidos pendientes
- pedidos atrasados
- cuentas por cobrar
- clientes con deuda vencida
- variación de tasa BCV / pricing alerts
- resumen de caja diario
- movimientos de producto
- reportes filtrables por fecha, canal, vendedor, ciudad, cliente, categoría

### Características del dashboard
- dinámico
- filtrable
- drill-down
- gráfico y tabular
- orientado a decisión
- responsive

---

## 23) Alertas del sistema

### Alertas obligatorias iniciales
- stock bajo
- diferencia de inventario
- producto bloqueado por inconsistencia
- cambio de tasa / repricing pendiente
- vendedor bajo meta
- pedido atrasado
- falla de integración Mercado Libre
- cuentas por cobrar vencidas

---

## 24) Auditoría y trazabilidad

Debe quedar auditado obligatoriamente:
- cambios de precio
- ajustes de inventario
- anulaciones
- descuentos
- cambios de tasa
- cambios de comisión (cuando se implemente)
- cierres de caja
- aprobación de crédito
- recepción/cierre de contenedor
- movimientos entre canales

Cada evento debe guardar como mínimo:
- actor
- fecha/hora
- acción
- entidad afectada
- valor anterior / nuevo si aplica
- motivo / metadata
- correlation ID / request ID (técnico)

---

## 25) UX / UI / experiencia de uso

### Principios de diseño
- visualmente atractiva
- profesional
- dinámica
- rápida
- usable en conexiones inestables
- excelente en móvil y desktop
- legible para operación intensiva

### Requisitos UX
- navegación móvil optimizada
- compatibilidad con móviles antiguos y actuales (Android/iOS)
- soporte para pistola de código de barras
- soporte opcional para cámara del móvil
- formularios rápidos
- búsquedas rápidas
- pantallas con feedback inmediato
- uso de animación sobria y útil (Framer Motion)

### Aplicación
- **Web app responsive** con fuerte orientación a PWA
- priorizar rendimiento, cache, estados vacíos, skeletons, optimistic UI controlada

---

## 26) Requisitos no funcionales

### Rendimiento
- respuesta rápida con 5.000+ SKU
- búsqueda muy ágil
- cargas masivas tolerables
- operaciones críticas resistentes a latencia

### Conectividad
- tolerancia a conexión inestable
- reintentos en acciones seguras
- colas/outbox para integraciones críticas

### Seguridad
- sin 2FA por ahora
- auditoría completa de acciones críticas
- sesiones seguras
- permisos estrictos por rol

### Mantenibilidad
- arquitectura modular clara
- logs estructurados
- observabilidad básica desde MVP

---

## 27) Recomendación de arquitectura técnica

### Recomendación principal
**Modular Monolith + Event-Driven Internals**

#### Por qué
- dominio amplio pero aún en fase temprana
- reduce complejidad operacional frente a microservicios
- permite separar módulos por bounded context
- facilita evolución posterior a servicios si hiciera falta
- soporta mejor trazabilidad y transacciones del core

### Bounded contexts sugeridos
- Identity & Access
- Catalog
- Inventory
- Pricing
- Procurement & Containers
- Sales
- Vendors
- Accounts Receivable
- Payments & Cash Closing
- Mercado Libre Connector
- WhatsApp Assisted Sales
- Reporting & Alerts
- Audit

### Patrones técnicos sugeridos
- domain events internos
- job queues / workers para procesos pesados
- outbox pattern para integraciones
- audit trail append-only
- soft locks / status locks para operaciones sensibles

---

## 28) Stack sugerido (recomendado, no obligatorio)

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- PWA capabilities

### Backend
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis (cache, queues, distributed locks ligeros)

### Integraciones / background
- BullMQ o similar
- Webhooks Mercado Libre
- Webhooks / APIs Meta WhatsApp Business

### Archivos / media
- almacenamiento objeto (S3-compatible) para comprobantes, imágenes y documentos

### Observabilidad
- logs estructurados
- métricas básicas
- error tracking

---

## 29) Modelo de datos de alto nivel (conceptual)

Entidades clave:
- User
- Role
- Permission
- EmployeeProfile
- VendorProfile
- Customer
- CustomerCreditProfile
- Brand
- Category
- Product
- ProductVariant (opcional / pendiente)
- ProductBarcode
- ProductPrice
- ProductCostSnapshot
- Warehouse
- StockLedger
- ChannelAllocation
- StockTransfer
- InventoryCount
- InventoryLock
- Supplier
- PurchaseOrder
- Container
- ContainerItem
- PackingListImport
- Receipt
- SalesOrder
- SalesOrderLine
- SalesChannel
- Payment
- PaymentEvidence
- InvoiceInternal
- DeliveryNote
- Quote
- CreditNote
- AccountsReceivableEntry
- ExchangeRateTable
- PriceRecalculationJob
- MercadoLibreOrder
- MercadoLibreShipment
- WhatsAppConversationRef (si aplica)
- AuditLog
- Alert

---

## 30) Flujos críticos a construir primero

### F1. Alta de producto y catálogo
### F2. Carga previa de packing list
### F3. Recepción y cierre de contenedor
### F4. Distribución de stock a canales
### F5. Venta tienda con pagos mixtos
### F6. Sincronización en tiempo real con Mercado Libre
### F7. Pedido del vendedor nacional → facturación interna
### F8. Repricing masivo por tabla de tasas
### F9. Cierre diario de caja
### F10. Dashboard ejecutivo con alertas

---

## 31) MVP recomendado

Aunque el negocio desea “todo”, para un MVP serio se recomienda priorizar:

1. autenticación + roles
2. catálogo de productos
3. inventario + movimientos + bloqueo
4. contenedores / packing list / recepción
5. pricing engine básico con tabla de tasas
6. ventas tienda + pagos + caja diaria
7. portal vendedor básico
8. integración Mercado Libre fase 1
9. dashboard gerencial inicial

### Fase 2 sugerida
- WhatsApp más profundo
- reportes avanzados
- cuentas por cobrar ampliadas
- promociones/reglas comerciales
- automatizaciones avanzadas
- IA para parsing/categorización asistida

---

## 32) Riesgos operativos/técnicos

1. Calidad de datos inicial baja o inconsistente.
2. Ambigüedad futura en costeo formal.
3. Repricing agresivo sin control de gobernanza si no se diseña bien la ventana de revisión.
4. Dependencia de integraciones externas (Mercado Libre / Meta).
5. Sobrecarga operativa si la UX no es muy rápida.
6. Catálogo multi-rubro exige taxonomía y atributos sólidos.

---

## 33) Pendientes abiertos del PRD (a cerrar en siguiente iteración)

1. Definición final de variantes (padre/hija vs SKU plano).
2. Método de costeo definitivo (operativo vs contable).
3. Reglas exactas de nota de crédito y efecto sobre stock.
4. Lógica exacta de cuentas por cobrar visible al vendedor.
5. Definición exacta de aprobaciones dobles por acción crítica.
6. Lista definitiva de widgets prioritarios del dashboard.
7. Definición exacta de campos por categoría.
8. Estrategia de migración y ambiente de prueba.
9. Priorización formal MVP vs fase 2.
10. Política exacta de fallback si Mercado Libre no sincroniza a tiempo.

---

## 34) Criterios de aceptación globales

El sistema será considerado exitoso si permite:
- saber con precisión dónde se vendió cada producto
- atribuir cada venta a canal y persona responsable
- evitar ventas sin stock real
- cargar/importar contenedores sin colapsar la operación
- recalcular precios masivamente por cambios de tasa
- dar visión clara al dueño sobre ventas, margen e inventario
- separar permisos de manera estricta y auditable

---

## 35) Instrucciones para Claude Code / Anti-Gravity

### Modo de ejecución esperado
- tratar este PRD como **fuente de verdad funcional inicial**
- identificar ambigüedades y convertirlas en `OPEN_QUESTIONS.md`
- proponer arquitectura modular
- generar esquema de base de datos inicial
- diseñar navegación UI por roles
- construir vertical slices priorizando módulos P0
- no simplificar reglas de inventario, pagos ni repricing
- mantener trazabilidad y bitácoras desde el primer commit

### Entregables técnicos esperados
1. domain model
2. ERD inicial
3. API contract draft
4. navigation map
5. module boundaries
6. job/queue design
7. alerting model
8. audit model
9. seed strategy
10. phased implementation plan

