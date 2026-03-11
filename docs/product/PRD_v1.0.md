# PRD v1.0 — ERP Comercial Omnicanal para Mayorista / Retail

## Estado del documento

- **Versión:** 1.0
- **Estado:** Cerrado para diseño, arquitectura y construcción inicial
- **Idioma operativo:** Español
- **Audiencia principal:** Claude Code Opus 4.6 Thinking / Anti-Gravity / equipo técnico / stakeholders operativos
- **Formato de salida esperado del desarrollo:** aplicación web moderna, mobile-first, con foco operativo, visual, rápida y auditable

---

## 1. Resumen ejecutivo

Se construirá una **plataforma ERP comercial omnicanal** para una empresa venezolana con operación principal en Caracas, venta nacional, modelo mixto **mayorista + retail**, más de **5.000 referencias activas** y crecimiento acelerado del catálogo.

La plataforma será la **fuente maestra de verdad operativa** para:

- catálogo técnico de productos
- inventario global y por canal
- recepción de contenedores y mercancía en tránsito
- pricing masivo por tasas
- ventas en tienda
- ventas asistidas por WhatsApp/Instagram
- portal de vendedores nacionales
- cuentas por cobrar
- pagos y cierre de caja
- integración con Mercado Libre
- trazabilidad operativa y auditoría
- panel ejecutivo del dueño/admin

El problema principal del negocio es el **descontrol de inventario**, seguido por la **falta de trazabilidad de ventas**, la **complejidad de recepción de contenedores**, la **actualización manual de precios** y la ausencia de una **visión central gerencial y operativa**.

---

## 2. Objetivo del producto

Diseñar e implementar un sistema web empresarial que permita:

1. Reducir diferencias de inventario.
2. Saber exactamente qué se vendió, dónde, cuándo, por quién y bajo qué documento.
3. Controlar stock por almacén, canal y flujo interno.
4. Gestionar mercancía importada antes, durante y después de la recepción.
5. Recalcular precios automáticamente según variación de tasas.
6. Operar ventas omnicanal con consistencia y trazabilidad.
7. Dar al dueño/admin una vista integral del negocio con KPIs, alertas y filtros avanzados.

---

## 3. Contexto del negocio

### 3.1 Naturaleza de la empresa

- Una sola empresa legal.
- Varias marcas bajo el mismo núcleo empresarial.
- Operación principal en Caracas, Venezuela.
- Distribución y venta a nivel nacional.
- Venta al mayor y al detal.

### 3.2 Distribución aproximada de ventas

- **Tienda física:** 60%
- **Vendedores nacionales:** 20%
- **Mercado Libre:** 15%
- **WhatsApp / Instagram / otros:** 5%

### 3.3 Naturaleza del catálogo

Catálogo multi-rubro tipo quincallería / retail de alto volumen, incluyendo:

- electrónica
- ferretería
- hogar
- maquillaje
- fiesta
- playa
- adulto
- maquinaria
- quincallería general
- accesorios y categorías derivadas

### 3.4 Escala

- Catálogo actual: **5.000+ SKU**
- Crecimiento esperado: agresivo en los próximos 3–6 meses
- Operación con alto volumen de referencias, contenedores y movimientos

---

## 4. Problemas principales a resolver

### P0. Inventario

- Recuentos frecuentes por diferencias operativas.
- Dificultad para saber el stock real.
- Errores por ventas no reflejadas, salidas manuales, errores de recepción y devoluciones mal registradas.
- Riesgo de stock negativo y desorden por canal.

### P0. Trazabilidad comercial

- No existe visibilidad perfecta de qué venta fue realizada por qué empleado o vendedor.
- Falta trazabilidad por cliente, canal, factura interna, pago y origen de la operación.

### P0. Recepción de contenedores

- Llegan contenedores high cube con muchísimas referencias.
- El packing list puede venir en CSV, Excel o PDF, incluso en chino.
- La carga masiva actual genera fricción y saturación.

### P0. Pricing

- Los precios se ajustan manualmente.
- El negocio necesita reacción rápida a cambios de BCV y uso interno de tasa paralela y RMB.
- No existe motor masivo de repricing.

### P1. Gestión gerencial

- Falta panel ejecutivo central con ventas, margen, stock, alertas, cobranzas y fallas operativas.

---

## 5. Objetivos de negocio a 3–6 meses

1. Reducir diferencias de inventario y bloquear ventas sobre productos inconsistentes.
2. Tener trazabilidad completa por canal, empleado, vendedor, cliente, documento y pago.
3. Optimizar la recepción de contenedores y la liberación de stock.
4. Automatizar la actualización de precios ante cambios de tasa.
5. Dar al dueño/admin una plataforma central de control operativo y estratégico.
6. Preparar al negocio para escalar catálogo, volumen y complejidad sin perder control.

---

## 6. No objetivos / fuera de alcance inicial

- Facturación fiscal integrada dentro del ERP.
- Marketplace adicional más allá de Mercado Libre en fase 1.
- Multiempresa.
- Multisucursal compleja.
- PWA obligatoria desde el día 1.
- Microservicios distribuidos.
- Automatización completa de WhatsApp como catálogo masivo.
- Notas de crédito como flujo operativo del MVP.

---

## 7. Usuarios y roles

## 7.1 Roles oficiales

1. **Dueño / Admin** (mismo nivel funcional)
2. **Supervisor**
3. **Empleado**
4. **Vendedor nacional**
5. **Marketing**
6. **Gerente** (rol configurable derivado por matriz de permisos; no bloquea el MVP)

## 7.2 Principios de autorización

- RBAC por rol.
- Permisos finos por módulo, acción y alcance de datos.
- Restricción por canal y por tipo de documento.
- Todo permiso sensible debe auditarse.

## 7.3 Permisos por rol

### Dueño / Admin

Acceso total. Puede:

- ver y operar todos los módulos
- ver costos internos, costo promedio y márgenes internos
- aprobar crédito
- forzar ventas con deuda
- cerrar contenedores
- aprobar y ajustar precios/tasas
- editar pedidos ya emitidos
- mover stock entre canales
- desbloquear productos con diferencias
- ver cuentas por cobrar
- ver dashboards y bitácora completa

### Supervisor

Puede:

- aprobar recepción operativa
- mover stock entre canales
- editar categorías
- editar productos
- ajustar inventario
- cerrar caja
- cambiar tasas y precios
- aprobar descuentos
- cerrar contenedores
- desbloquear productos con diferencias

No puede:

- ver costos internos
- ver margen interno
- ver cuentas por cobrar
- forzar ventas con deuda

### Empleado

Puede:

- vender en tienda
- crear pedidos
- registrar pagos
- confirmar pedidos manuales de WhatsApp/Instagram si tiene permiso
- emitir factura interna
- ver stock
- editar categorías (según permiso habilitado)
- editar productos (solo si la matriz de permisos se lo habilita en ciertos flujos operativos)

No puede:

- ver costos internos
- ver cuentas por cobrar
- editar precios
- mover stock entre canales
- mover stock entre almacenes
- ver margen interno

### Vendedor nacional

Puede:

- crear pedido desde su portal
- ver stock disponible del canal de vendedores
- ver sus clientes
- ver sus ventas
- ver sus cuentas por cobrar / cartera de sus clientes
- registrar información de pago si su flujo lo requiere

No puede:

- ver márgenes internos
- ver ventas globales del negocio
- ver productos o ventas de otros vendedores
- editar precios
- facturar directamente

### Marketing

Puede:

- ver catálogo
- ver productos
- ver precios de venta
- ver stock básico
- ver promociones
- ver métricas comerciales / campañas

No puede:

- tocar inventario operativo
- tocar ventas operativas
- tocar costos internos

---

## 8. Módulos del sistema

1. Autenticación y autorización
2. Catálogo de productos y categorías
3. Inventario multialmacén y multicanal
4. Compras / importaciones / contenedores
5. Pricing engine y panel de tasas
6. Ventas tienda
7. Ventas asistidas por WhatsApp / Instagram
8. Portal de vendedores nacionales
9. Clientes, crédito y cuentas por cobrar
10. Pagos y cierre de caja
11. Integración Mercado Libre
12. Dashboard gerencial
13. Reportes y exportaciones
14. Bitácora / auditoría / aprobaciones
15. Búsqueda global
16. Impresión operativa

---

## 9. Modelo de producto y catálogo

## 9.1 Estructura de SKU

Cada variante se maneja como **producto independiente / SKU independiente**.

Ejemplos:

- Producto rojo y amarillo = SKU distintos
- 110V y 220V = SKU distintos
- Variaciones por tamaño/potencia = SKU distintos

## 9.2 Unidades de venta soportadas

- unidad
- docena
- caja
- bulto

## 9.3 Equivalencias

- Las equivalencias se configuran manualmente por producto.
- Deben poder modificarse a futuro.
- Solo **admin** y **supervisor** pueden editar equivalencias.
- Deben definirse idealmente antes de aprobar un producto nuevo proveniente de contenedor.

## 9.4 Categorías

- Las categorías deben organizarse en **árbol jerárquico**.
- Pueden ser creadas/editadas por **admin, supervisor y empleado** según permisos.
- Deben ser extensibles.

## 9.5 Marca y proveedor

- **Marca:** lista administrable.
- **Proveedor:** no es prioritario como catálogo maestro en fase 1, pero el sistema debe permitir relación futura.
- Un producto puede tener **más de un proveedor**.

## 9.6 Campos obligatorios para aprobar un producto nuevo

- código interno
- nombre
- categoría
- marca
- código de barras
- peso
- volumen
- descripción corta
- atributos técnicos

## 9.7 Campos funcionales del producto

- código interno
- código de barras
- nombre
- categoría
- marca
- imagen
- peso
- volumen
- compatibilidad
- descripción corta
- descripción larga
- atributos técnicos dinámicos
- precios por modalidad
- estado del producto
- stock global y por canal

## 9.8 Atributos técnicos dinámicos

Cada categoría debe soportar atributos dinámicos, por ejemplo:

- voltaje
- watts
- color
- potencia
- material
- garantía / sanidad si aplica
- compatibilidad
- medidas
- otros atributos específicos

---

## 10. Inventario y almacenes

## 10.1 Principio de stock

Debe existir:

- **stock general maestro**
- stock / asignación por canal
- stock por almacén

## 10.2 Almacenes / estados de stock

El sistema debe soportar como mínimo:

- almacén principal
- stock de tienda
- stock en tránsito
- stock reservado / emergencia
- stock defectuoso
- almacenes físicos internos adicionales utilizados por la operación

## 10.3 Canales con visibilidad / asignación

- tienda física
- Mercado Libre
- vendedores nacionales
- WhatsApp
- Instagram

### Regla clave

WhatsApp e Instagram **consumen stock de tienda**. No tienen stock independiente.

## 10.4 Distribución inicial de mercancía nueva

- Se hace **manualmente**.
- Solo la pueden hacer **admin** y **supervisor**.

## 10.5 Movimiento entre canales

- Se permite mover stock de un canal a otro.
- Solo lo pueden hacer **admin** y **supervisor**.

## 10.6 Control de stock negativo

- La venta debe bloquearse si no hay stock real.
- No se debe permitir inventario negativo operativo.

## 10.7 Diferencias de inventario

Si se detecta una diferencia:

- el ajuste no es automático
- queda pendiente de aprobación
- el producto puede quedar bloqueado para venta según flujo operativo
- la liberación/desbloqueo la hacen admin o supervisor

## 10.8 Conteos físicos

Se soportan:

- conteos completos
- conteos parciales
- conciliación posterior con aprobación

## 10.9 Movimientos internos entre almacén y tienda

Cada movimiento debe registrar:

- quién lo hizo
- observación
- firma simple
- cantidades
- origen y destino
- fecha/hora

---

## 11. Compras, contenedores e importación

## 11.1 Flujo general

1. Se carga packing list antes de la llegada física.
2. La mercancía queda en estado de tránsito / standby.
3. Se valida la recepción contra lo esperado.
4. Se crean o completan fichas de producto faltantes.
5. Se aprueba el cierre del contenedor.
6. Se promueve el stock desde standby a stock real.
7. Se distribuye a los canales / almacenes correspondientes.

## 11.2 Formatos de entrada del packing list

- CSV
- Excel
- PDF

## 11.3 Documentos fuente

- packing list como documento principal
- posibilidad de soportar metadatos de contenedor

## 11.4 Información mínima del contenedor

- número de contenedor
- fecha de salida
- fecha de llegada
- costo FOB
- gastos asociados futuros si se expanden

## 11.5 Estado del contenedor

- creado
- embarcado / en tránsito
- recibido total
- cerrado

## 11.6 Reglas de aprobación

- La aprobación final del contenedor requiere **admin y supervisor** según matriz actual definida.
- El stock en tránsito / standby no se suma al stock real hasta que el contenedor esté aprobado/cerrado.

## 11.7 Carga documental compleja

Como muchos documentos pueden venir en chino, el sistema debe contemplar un pipeline de normalización/asistencia para facilitar:

- lectura del packing list
- revisión humana
- mapeo a productos
- prealta en catálogo

## 11.8 Productos nuevos al recibir

Si un producto es nuevo:

- debe existir ficha mínima completa antes de aprobación
- puede capturarse código de barras con scanner
- la imagen es deseable y muy importante para operación

---

## 12. Costeo y pricing

## 12.1 Política de costeo actual

El método contable definitivo no se cierra en esta versión, pero operativamente el sistema debe manejar:

- costo base China
- costo con flete
- costo total importado
- costo promedio actual

Estos costos solo son visibles para **dueño/admin**.

## 12.2 Reglas de costo promedio

Cuando entra el mismo producto con un costo distinto:

- el sistema debe recalcular **costo promedio actual**
- el objetivo es evitar distorsionar el precio por una sola entrada más cara o más barata

## 12.3 Tipos de precio oficiales

- precio tienda
- precio mayor
- precio vendedor nacional
- precio promo online

No se manejarán listas personalizadas amplias ni precio especial por cliente.

## 12.4 Panel de tasas

Debe existir un panel visible y editable por **admin y supervisor** para:

- BCV
- tasa paralela / interna
- RMB

## 12.5 Repricing automático por variación de tasa

### Regla cerrada

- Si **BCV cambia 5% o más**, el sistema debe **actualizar automáticamente los precios**.
- Debe dispararse una **alerta al admin**.
- Los nuevos precios se aplican de inmediato.
- El admin tiene una ventana de **24 horas** para aprobar, ratificar o ajustar.
- Si la tasa vuelve a moverse, el sistema puede recalcular nuevamente.

## 12.6 Repricing manual asistido

Además del disparador automático, admin y supervisor podrán modificar parámetros de BCV, paralela o RMB y provocar recalculo masivo.

## 12.7 Auditoría de precios

Cada cambio de precio debe registrar:

- valor anterior
- valor nuevo
- tasa usada
- actor
- fecha/hora
- motivo

## 12.8 Margen

El dueño/admin debe poder ver margen por:

- producto
- categoría
- canal
- vendedor
- cliente

---

## 13. Ventas y flujos comerciales

## 13.1 Tipos de venta

- mostrador / tienda
- mayorista
- vendedor en ruta / vendedor nacional
- online asistido
- Mercado Libre
- WhatsApp
- Instagram
- Facebook (si se usa como origen de contacto)

## 13.2 Venta en tienda — flujo

1. Buscar o escanear productos.
2. Agregar cantidades.
3. Mostrar importe final.
4. Cobrar por los métodos soportados.
5. Registrar pago completo con referencias.
6. Si el cliente necesita factura interna, solicitar datos.
7. Emitir documentos correspondientes.

### Reglas

- El empleado **no puede cambiar precios**.
- El cliente puede comprar sin registro previo si no requiere factura.
- Si cambia el operador en caja, debe hacerse con el usuario correcto del nuevo empleado.

## 13.3 Venta por vendedor nacional — flujo

1. El vendedor crea pedido desde su portal.
2. El pedido entra para revisión/facturación interna.
3. El vendedor **no factura**.
4. El empleado/supervisor/admin emite la factura interna.
5. El vendedor ve solo lo suyo.

### Regla de stock del canal vendedores

El stock del canal vendedores es **compartido a nivel canal**, no reservado por vendedor individual.

## 13.4 Venta por WhatsApp / Instagram

- Son canales híbridos/manuales.
- El sistema debe permitir crear:
  - pedido
  - venta directa
  - registro de pago
- Cualquier usuario con permisos puede confirmar estas ventas.
- No se implementa catálogo automático de WhatsApp en el MVP.
- No se requieren mensajes automáticos por ahora.

## 13.5 Mercado Libre

### Requisitos

- importar pedidos
- sincronizar stock
- registrar venta final
- descontar inventario automáticamente
- consultar estado de envío
- panel específico de administración de Mercado Libre

### Fallo de integración

Si falla la sincronización:

- se descuenta localmente
- se alerta al admin
- el sistema reintenta hasta sincronizar

### Pedidos

Los pedidos pueden:

- crearse automáticamente
- o quedar en revisión según reglas

---

## 14. Clientes, crédito y cuentas por cobrar

## 14.1 Tipos de cliente

- retail
- mayorista
- distribuidor
- VIP
- marketplace
- clientes de vendedores

## 14.2 Crédito

El crédito aplica principalmente a clientes manejados por vendedores nacionales.

### Campos obligatorios

- días de crédito
- fecha de vencimiento
- saldo pendiente

### Regla

- Solo **admin** puede aprobar crédito.
- La información de crédito debe reflejarse en la factura/documento correspondiente.

## 14.3 Bloqueo por deuda

Si el cliente tiene deuda vencida o excede lo permitido:

- la venta se bloquea
- solo **admin** puede forzar manualmente la venta

## 14.4 Visibilidad

- Dueño/admin ven cuentas por cobrar globales.
- Vendedor ve solo la cartera de sus clientes.
- Supervisor no ve cuentas por cobrar.
- Empleado no ve cuentas por cobrar.

---

## 15. Pagos y cierre de caja

## 15.1 Métodos de pago soportados

- pago móvil
- transferencia
- efectivo
- punto de venta / tarjeta
- otros métodos operativos locales si se parametrizan

## 15.2 Pago mixto

Una venta puede tener **múltiples métodos de pago**.

## 15.3 Regla de cierre de venta

La suma de los pagos registrados debe coincidir exactamente con el total de la venta para cerrar correctamente.

## 15.4 Evidencias

Se pueden adjuntar múltiples imágenes / comprobantes si aplica.

## 15.5 Metadatos por pago

Según el método, registrar:

- referencia
- monto
- hora
- nombre del pagador si aplica
- cédula / identidad si aplica
- número de recibo / confirmación si aplica
- imágenes si aplica

## 15.6 Validación de pagos

Pueden registrar/validar pagos usuarios con permisos operativos adecuados, pero la auditoría debe dejar claro quién lo hizo.

## 15.7 Cierre de caja

- Habrá **un cierre global diario del negocio**.
- Admin y supervisor pueden cerrarlo.
- Debe existir resumen de caja diario.

---

## 16. Documentos del sistema

## 16.1 Documentos oficiales del ERP

- cotización
- pedido
- nota de entrega
- factura interna
- recibo de pago

## 16.2 Documentos fuera de alcance operativo

- factura fiscal: se maneja fuera del sistema
- notas de crédito: no se trabajarán en este PRD v1.0

## 16.3 Flujo documental base

**Cotización → Pedido → Factura interna → Recibo**

## 16.4 Reglas

- La nota de entrega se usa **siempre**.
- La factura interna se genera **solo si el cliente la pide**.
- El recibo se genera **siempre**.
- La cotización está disponible para todos los canales **excepto Mercado Libre**.

## 16.5 Estados de pedido

- borrador
- pendiente confirmación
- confirmado
- facturado
- despachado
- entregado
- anulado

## 16.6 Edición posterior

Un pedido / documento ya emitido solo puede editarlo **admin**.

---

## 17. Dashboard ejecutivo y analítica

## 17.1 Home del dueño/admin

Debe mostrar como mínimo:

- ventas del día
- ventas de ayer
- ventas de la semana
- ventas por canal
- ventas por vendedor
- margen del día
- top productos vendidos
- productos sin movimiento
- stock bajo
- diferencias de inventario
- productos bloqueados
- pedidos pendientes
- cuentas por cobrar (como alerta y visión útil)
- resumen de caja
- alertas por cambio de tasa
- actividad reciente del sistema

## 17.2 Alertas críticas (rojo / alta prioridad)

- stock bajo
- diferencia de inventario
- cambio de tasa BCV
- fallo de integración con Mercado Libre
- caja descuadrada
- deuda vencida

## 17.3 Alertas amarillas

- pedidos atrasados
- facturas no cobradas
- pedidos no confirmados

## 17.4 Comparativas

Las comparativas deben ser **editables y dinámicas**, no fijas. Deben soportar:

- hoy vs ayer
- semana vs semana pasada
- mes vs mes pasado
- otras comparativas configurables

## 17.5 Filtros globales

El dashboard y reportes deben poder filtrarse por casi todo, incluyendo:

- fecha
- canal
- vendedor
- ciudad / estado
- cliente
- categoría
- producto

## 17.6 Actividad reciente

Obligatoria. Debe mostrar eventos como:

- última venta
- último ajuste de inventario
- último cambio de precio
- último cierre de caja
- último pedido de Mercado Libre
- último movimiento entre almacenes

---

## 18. Reportes, exportaciones y búsqueda

## 18.1 Exportaciones

- Excel
- PDF

## 18.2 Reportes obligatorios MVP

- ventas por fecha
- ventas por canal
- ventas por vendedor
- inventario actual
- movimientos de inventario
- productos sin movimiento
- stock bajo
- cuentas por cobrar
- clientes vencidos
- caja diaria
- margen por producto
- margen por vendedor
- pedidos pendientes
- pedidos Mercado Libre
- cambios de precio / tasa
- recepción de contenedores

## 18.3 Búsqueda global

Obligatoria. Debe encontrar:

- producto
- cliente
- pedido
- factura interna
- vendedor
- pago
- contenedor

## 18.4 Bitácora / auditoría visible

Obligatoria. Debe permitir ver:

- quién hizo qué
- cuándo
- desde qué módulo
- qué cambió antes/después si aplica

## 18.5 Impresión directa

Debe soportar impresión de:

- etiquetas
- notas de entrega
- facturas internas
- recibos
- packing list / recepción

---

## 19. UX, rendimiento y conectividad

## 19.1 Tipo de aplicación

- Web app moderna.
- Muy rápida.
- Mobile-friendly.
- Visual y profesional.
- Preparada para evolucionar a PWA a futuro.

## 19.2 Usuarios móviles principales

- vendedores nacionales
- supervisor
- dueño/admin

## 19.3 Escaneo

- soporte para pistola de código de barras
- soporte para cámara de móvil como respaldo

## 19.4 Conexión inestable

Obligatorio desde MVP:

- reintento automático
- guardado temporal / autosave
- caché de catálogos
- aviso de sin conexión / reconectando

## 19.5 Persistencia temporal segura

El sistema debe tener una capa de borradores / respaldo temporal para procesos largos o críticos (por ejemplo, carga de packing list y recepción) de modo que:

- el usuario no pierda información si cae la conexión
- los cambios no confirmados aún no entren necesariamente a la base final
- al volver la conexión, el usuario pueda recuperar y consolidar el trabajo

---

## 20. Requisitos no funcionales

## 20.1 Rendimiento

- Debe ser rápida con catálogos grandes.
- Debe optimizar búsquedas, tablas y formularios.
- Debe priorizar fluidez en dispositivos móviles y conexiones limitadas.

## 20.2 Seguridad

- RBAC estricto
- bitácora obligatoria
- historial de eventos críticos
- costos y márgenes internos restringidos a dueño/admin

## 20.3 Trazabilidad

Debe auditar como mínimo:

- cambios de precio
- cambios de tasa
- ajustes de inventario
- movimientos entre canales
- cierres de caja
- aprobaciones operativas
- recepción de contenedores
- edición de documentos emitidos

## 20.4 Logs y monitoreo

Obligatorio desde el inicio:

- logs de sistema
- monitoreo de errores
- trazabilidad de acciones críticas

## 20.5 Backups

Deseables, pero quedan como requisito posterior, no bloqueante del MVP.

## 20.6 Infraestructura

Se deja **abierta por ahora**: nube / VPS / otra opción según decisión técnica final.

---

## 21. Arquitectura recomendada

## 21.1 Estilo

- **Modular monolith**
- eventos internos para side effects
- integraciones desacopladas
- persistencia relacional fuerte

## 21.2 Módulos sugeridos a nivel técnico

- auth / identity / permissions
- catalog
- categories / brands / attributes
- inventory
- warehouses / channels / transfers
- receiving / containers
- pricing / exchange-rates
- sales / documents
- customers / accounts-receivable
- payments / cash-closure
- vendor-portal
- mercadolibre-integration
- whatsapp-assisted-sales
- dashboards / reporting
- audit / approvals / notifications
- search

## 21.3 Principios de diseño

- fuente maestra de verdad interna
- canal no domina al core
- inventario basado en ledger / movimientos
- pricing masivo, no individual
- auditoría append-only para eventos sensibles
- resiliencia ante conectividad débil

---

## 22. Modelo de datos inicial (alto nivel)

### 22.1 Entidades núcleo

- users
- roles
- permissions
- user_role_assignments
- categories
- brands
- suppliers (future-ready)
- products
- product_attributes
- product_units
- product_equivalences
- warehouses
- channels
- stock_balances
- stock_allocations
- inventory_movements
- inventory_counts
- inventory_discrepancies
- containers
- container_items
- inbound_documents
- exchange_rates
- price_rules
- product_prices
- price_history
- customers
- customer_credit_terms
- accounts_receivable
- sales_orders
- order_items
- delivery_notes
- internal_invoices
- receipts
- payments
- payment_evidences
- vendor_profiles
- vendor_customers
- marketplace_orders
- marketplace_sync_logs
- approvals
- audit_logs
- dashboard_snapshots (optional future)

### 22.2 Entidades críticas

#### products

- id
- internal_code
- barcode
- name
- category_id
- brand_id
- short_description
- long_description
- weight
- volume
- compatibility
- status
- image_url

#### product_prices

- product_id
- store_price
- wholesale_price
- vendor_price
- promo_online_price
- effective_rate_snapshot_id
- approved_by
- approved_at

#### inventory_movements

- id
- product_id
- quantity
- unit
- movement_type
- source_location_id
- target_location_id
- source_channel_id
- target_channel_id
- actor_user_id
- observation
- signature_reference
- created_at

#### containers

- id
- container_number
- departure_date
- arrival_date
- fob_cost
- status
- created_by
- approved_by
- closed_at

#### payments

- id
- sale_id / invoice_id
- method
- amount
- reference_number
- payer_name
- payer_document
- paid_at
- created_by

#### accounts_receivable

- id
- customer_id
- invoice_id
- due_date
- credit_days
- outstanding_balance
- status

---

## 23. Reglas de aprobación

### 23.1 Matriz cerrada

- **venta a crédito:** admin
- **ajuste manual de inventario:** admin
- **mover stock entre canales:** admin y supervisor
- **desbloquear producto con diferencia:** admin y supervisor
- **cambio de precios/tasas:** admin y supervisor
- **cierre de contenedor:** admin y supervisor
- **cierre de caja:** admin y supervisor
- **nota de crédito:** no aplica
- **editar pedido ya facturado:** admin

---

## 24. MVP y roadmap

El negocio desea prácticamente todo, pero para construcción técnica se definen prioridades por fases.

## 24.1 Módulos obligatorios del MVP funcional

El usuario indicó “todos” como obligatorios. Para implementación se interpreta como **MVP ampliado**, con estos bloques incluidos desde la primera salida funcional:

- autenticación y roles
- catálogo de productos
- inventario y movimientos
- recepción de contenedores
- pricing dinámico
- ventas en tienda
- portal de vendedores
- cuentas por cobrar
- pagos y cierre de caja
- dashboard gerencial
- Mercado Libre
- WhatsApp manual
- reportes
- alertas
- auditoría / bitácora

## 24.2 Fase 0 — Foundation

- stack base
- auth
- permisos
- layout
- diseño de sistema
- logging
- auditoría base

## 24.3 Fase 1 — Core operativo

- catálogo
- categorías
- marcas
- productos
- inventario
- almacenes
- canales
- movimientos
- conteos

## 24.4 Fase 2 — Importación / contenedores

- packing list
- estados de contenedor
- recepción
- stock standby
- liberación aprobada

## 24.5 Fase 3 — Pricing

- panel de tasas
- repricing automático
- historial de precios
- margen

## 24.6 Fase 4 — Ventas y pagos

- ventas tienda
- documentos
- pagos mixtos
- recibos
- caja diaria

## 24.7 Fase 5 — Vendedores / crédito

- portal vendedor
- cartera
- pedidos
- crédito
- cuentas por cobrar

## 24.8 Fase 6 — Mercado Libre / WhatsApp

- integración ML
- panel ML
- ventas manuales WhatsApp/Instagram

## 24.9 Fase 7 — Dashboard / reportes / hardening

- KPIs
- bitácora avanzada
- exportaciones
- búsqueda global
- impresión
- optimizaciones

---

## 25. Estrategia de migración y go-live

## 25.1 Carga inicial

Primera carga:

- catálogo
- precios
- stock inicial

## 25.2 Datos históricos viejos

- se migrarán en **segunda fase**

## 25.3 Ambientes

- prueba
- producción

## 25.4 Validación operativa

- dueño/admin
- supervisor

## 25.5 Go-live

- primero interno
- luego real

---

## 26. Criterios de aceptación globales

El sistema se considerará aceptable si:

1. Permite vender sin perder trazabilidad.
2. No permite cerrar ventas con pagos incompletos.
3. Permite bloquear productos con diferencias críticas.
4. Refleja stock global y por canal de forma consistente.
5. Procesa recepción de contenedor con estado standby y liberación aprobada.
6. Recalcula precios automáticamente ante variación >= 5% BCV.
7. Permite al dueño/admin ver márgenes y KPIs completos.
8. Permite al vendedor operar solo su universo.
9. Mantiene bitácora visible de acciones críticas.
10. Soporta trabajo con conectividad inestable sin pérdida de datos críticos en formularios largos.

---

## 27. Riesgos operativos a evitar

Errores imperdonables en producción:

- stock incorrecto
- precio incorrecto
- venta mal atribuida
- pago mal conciliado
- pedido perdido
- integración Mercado Libre fallando sin control
- pérdida de información por caída de conexión

La prioridad técnica es **doble**:

- velocidad operativa
- trazabilidad y seguridad

Ambas al mismo nivel.

---

## 28. Backlog técnico inicial sugerido

## Sprint 0

- estructura base del repo
- auth + roles + permisos
- layout base
- sistema de diseño
- logging + audit infra
- estrategia de draft/autosave

## Sprint 1

- categorías
- marcas
- productos
- atributos dinámicos
- equivalencias
- búsqueda de productos

## Sprint 2

- almacenes
- canales
- stock maestro
- stock allocation
- movimientos
- conteos
- bloqueos por discrepancia

## Sprint 3

- contenedores
- packing list upload
- parser pipeline
- standby stock
- aprobación/cierre

## Sprint 4

- panel de tasas
- reglas de repricing
- price history
- dashboard de margen

## Sprint 5

- POS tienda
- documentos
- pagos mixtos
- recibos
- cierre de caja

## Sprint 6

- clientes
- crédito
- cuentas por cobrar
- portal vendedor

## Sprint 7

- Mercado Libre
- panel de sync
- WhatsApp/Instagram manual

## Sprint 8

- dashboard ejecutivo
- reportes
- exportaciones
- impresión
- búsqueda global
- hardening

---

## 29. Decisiones técnicas cerradas para el equipo

- construir en **nuevo proyecto / nueva carpeta**
- tratar el proyecto anterior solo como referencia técnica reutilizable
- mantener separación clara entre core ERP y conectores
- priorizar rendimiento, auditoría y resiliencia
- no depender de conexión perfecta para formularios largos

---

## 30. Resultado esperado

Al completar la primera versión funcional, la empresa debe poder:

- cargar catálogo y stock inicial
- operar ventas con documentos y pagos correctos
- trabajar con vendedores y cuentas por cobrar
- recibir contenedores sin improvisación
- recalcular precios automáticamente
- ver alertas críticas en tiempo real
- tener un dashboard profesional de control del negocio

---

## 31. Entregable siguiente recomendado

Después de este PRD v1.0, el siguiente entregable recomendado es:

1. **ERD detallado**
2. **Definición exacta de tablas y relaciones**
3. **Lista de endpoints / actions / routers**
4. **Plan técnico de implementación por carpetas y módulos**
5. **Historias de usuario + criterios de aceptación por módulo**
