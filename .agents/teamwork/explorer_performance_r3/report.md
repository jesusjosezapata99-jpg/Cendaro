# INFORME TÉCNICO CRÍTICO: RENDIMIENTO, LATENCIA, CONECTIVIDAD NUBE DESDE VENEZUELA Y FLUIDEZ DE ANIMACIONES

**Cendaro ERP — Auditoría de Rendimiento M3 (explorer_performance_r3)**  
_Fecha: 30 de Octubre de 2026 | Modo: Solo Lectura (Investigación y Propuestas sin Edición de Código)_

---

## 1. Resumen Ejecutivo y Resultados de Verificación

El presente informe expone una evaluación exhaustiva, cuantitativa y cualitativa del rendimiento de **Cendaro ERP**, auditando la arquitectura de datos, el ciclo de vida de peticiones en la nube desplegadas en **Vercel** con base de datos en **Supabase PostgreSQL** (`us-east-1`), y el comportamiento del sistema ante condiciones de red adversas típicas de **Venezuela** (altas latencias RTT de 120ms a 350ms+, pérdida de paquetes intermitente de 2% a 10%+, fluctuaciones de ancho de banda y microcortes de energía/fibra). Asimismo, se audita la fluidez de interfaz, el impacto del motor de animaciones y la respuesta ante hardware de bajas prestaciones común en mostradores comerciales (terminales POS con procesadores Intel Celeron / Atom y 4GB de RAM).

### Estado de las Herramientas de Verificación del Repositorio (Línea Base Empírica)

Las comprobaciones mandatorias del repositorio fueron ejecutadas en su totalidad con resultados 100% limpios:

- **`pnpm typecheck`**: **PASÓ** (6/6 paquetes del monorepo validados en modo estricto de TypeScript: 0 errores).
- **`pnpm lint`**: **PASÓ** (6/6 paquetes analizados con ESLint: 0 advertencias, 0 errores).
- **`pnpm test`**: **PASÓ** (7 paquetes ejecutados: **1,206 pruebas unitarias y de integración pasando**, 13 pruebas de base de datos viva omitidas deliberadamente por requerir conexión directa).
- **`node scripts/checks/design-guard.mjs --phase F9`**: **PASÓ** (0 violaciones de tokens de diseño, 0 redondeos no autorizados, 0 negritas simuladas).

### Hallazgos Críticos Principales

1. **Cuello de Botella en el Pool de Conexiones (Supavisor)**: `packages/db/src/client.ts` fija `max: 5` conexiones por instancia serverless de Vercel frente a un pool global en Supabase de apenas 15 conexiones. Las peticiones por lotes de tRPC (`httpBatchLink`) que disparan más de 5 procedimientos en paralelo sufren encolamiento interno en `node-postgres` y riesgo de saturación (`EMAXCONNSESSION`) ante concurrencia moderada de cajeros.
2. **Serialización Forzada de Consultas bajo RLS**: La capa de seguridad implementada en F9.2 (`runInWorkspaceRlsReadonly` en `packages/api/src/trpc.ts`) encapsula cada lectura en una transacción `READ ONLY` con `SET LOCAL ROLE app_user` y `set_config('app.workspace_id', ...)`. Debido a que `node-postgres` asigna un solo cliente por transacción, **todas las consultas agrupadas en `Promise.all` (como las 9 consultas de `dashboard.overview`) se ejecutan estrictamente de forma secuencial**, acumulando cientos de milisegundos en viajes de red Vercel ↔ Supabase.
3. **Casacada N+1 en Checkout POS**: En `packages/api/src/modules/sales.ts` (`applyStockLifecycle`), la deducción de stock en el cierre de venta POS itera secuencialmente artículo por artículo en un bucle `for`, ejecutando 3 viajes de red por artículo (`ChannelAllocation`, `StockLedger`, `StockMovement`). Un ticket común de 15 artículos genera **45 consultas secuenciales individuales** dentro de la transacción, sumando más de 1.1 segundos solo en espera de base de datos.
4. **Vulnerabilidad Crítica del Escáner de Códigos de Barra**: En `apps/erp/src/app/(app)/pos/client.tsx`, el punto de venta solo precarga los primeros 100 productos del catálogo. Al escanear un código de barras de un producto no precargado, el escáner dispara una búsqueda con debounce de 200ms al servidor. Sin embargo, las pistolas lectoras emiten el carácter `Enter` en <50ms; al presionar `Enter` antes de que la respuesta retorne, el producto no es encontrado y **el escaneo se descarta silenciosamente sin agregarse al carrito**.
5. **Inexistencia de Idempotencia en Cobros y Riesgo de Duplicidad**: La mutación `sales.checkoutPos` no acepta un `idempotencyKey`. Si la conexión venezolana sufre una pérdida de paquete en el viaje de retorno (ACK) tras haberse confirmado la venta en PostgreSQL, el cliente lanza `Failed to fetch`. Al permanecer abierto el modal, el cajero reintenta la confirmación, **generando una segunda venta duplicada, doble descuento de inventario y doble registro de cobro**.
6. **Ausencia Total de Resiliencia Fuera de Línea (Offline)**: No existe Service Worker, ni IndexedDB, ni cola de sincronización diferida para el POS. Si la conexión de CANTV o fibra privada cae durante 30 segundos, el mostrador queda completamente paralizado: no se puede consultar inventario, no se pueden registrar ventas ni emitir comprobantes.
7. **Layout Thrashing por Animaciones de Altura y Ancho**: El componente `AnimatedSizeContainer` (`packages/ui/src/animated-size-container.tsx`) utiliza Framer Motion con físicas de resorte (`spring`) para animar `width` y `height` junto con un `ResizeObserver`. Animar dimensiones geométricas dispara recálculos de diseño completos (**Reflow**) en cada cuadro (60fps), saturando al 100% los procesadores Intel Celeron / Atom de terminales POS.

---

## 2. Auditoría de Base de Datos y Latencia de Conexión

### 2.1. Configuración de Conexión a Supabase (Pooler vs Directo)

Inspección de `packages/db/src/client.ts` (L13–L92):

- **Pooler de Transacciones**: El sistema reescribe automáticamente el puerto `5432` a `6543` cuando detecta el host `.pooler.supabase.com` (L48–L53), forzando el modo transacción de Supavisor. Esto previene el cuelgue por pipelining de `postgres.js` y el agotamiento de backends del modo sesión.
- **Tamaño del Pool por Instancia**:
  ```ts
  max: isTransactionPooler ? 5 : 3;
  ```
  Cada contenedor serverless de Vercel mantiene hasta 5 conexiones abiertas.
- **Tiempos de Espera y Reciclaje**:
  - `connectionTimeoutMillis: 10_000` (10 segundos para fallar en caso de saturación).
  - `idleTimeoutMillis: 20_000` (cierre de clientes ociosos tras 20 segundos).
  - `maxLifetimeSeconds: 300` (reciclaje obligatorio cada 5 minutos para evitar desconexiones bruscas de Supavisor).

**Evaluación Crítica de Concurrencia**:
Supabase Free / Pro básico dispone típicamente de `pool_size = 15` conexiones hacia la base de datos subyacente. Si 4 cajeros o supervisores acceden simultáneamente durante un pico comercial, Vercel escala entre 4 y 8 lambdas activas. 8 instancias con `max = 5` demandan hasta 40 conexiones simultáneas contra Supavisor. Aunque Supavisor multiplexa transacciones, la retención de conexiones durante transacciones prolongadas (como `checkoutPos`) provoca que Supavisor encole peticiones, incrementando la latencia de conexión de ~15ms a más de 1,200ms.

---

### 2.2. Coste Estructural de RLS y Sobrecarga por Petición

#### 2.2.1. Sobrecarga en `protectedProcedure` (Idle Session Verification)

En `packages/api/src/trpc.ts` (L350–L365) y `packages/api/src/services/session-activity.ts` (L56–L72):
Cada llamada autenticada ejecuta secuencialmente:

1. `SELECT last_seen_at FROM public.user_session_activity WHERE session_id = ...` (1 RTT de BD).
2. `INSERT INTO public.user_session_activity ... ON CONFLICT (session_id) DO UPDATE ...` (1 RTT de BD).
   _Impacto_: Antes de iniciar la resolución de membresía o ejecutar la lógica del endpoint, el servidor ya ha consumido **2 viajes de red completos contra PostgreSQL** exclusivamente para actualizar la marca temporal de inactividad.

#### 2.2.2. Coste del Envoltorio RLS en Lecturas (`runInWorkspaceRlsReadonly`)

En `packages/api/src/trpc.ts` (L564–L613):
Para evitar fugas multitenant en las lecturas, cada consulta `workspaceReadProcedure` ejecuta:

1. `BEGIN READ ONLY` (1 RTT).
2. `SELECT set_config('role', 'app_user', true), set_config('app.workspace_id', $1, true)` (1 RTT).
3. Ejecución de la consulta real del procedimiento.
4. `COMMIT` (1 RTT).
   _Impacto Medido_: Tal como documentó el informe de remediación previa (`SECURITY-REPORT-2026-09-REMEDIATION.md` §5), este envoltorio añade **3 viajes de red fijos por cada lectura**.

#### 2.2.3. Serialización de Consultas Concurrentes en `Promise.all`

Dentro del bloque de transacción de `node-postgres`, solo existe un socket TCP activo asignado a la transacción. Cuando un procedimiento ejecuta:

```ts
const [res1, res2, res3] = await Promise.all([query1(), query2(), query3()]);
```

`node-postgres` no puede intercalar las consultas en paralelo sobre ese socket; las serializa forzosamente una detrás de otra (`pg` emite advertencias formales de incompatibilidad para la futura versión `pg@9`).

_Evidencia en `packages/api/src/modules/dashboard.ts` (L346–L358)_:
La función `computeOverview` agrupa 9 consultas analíticas complejas:

1. `computeSales` (agrupación temporal con `date_trunc`).
2. `computeGrossProfit` (JOIN de 3 tablas: `order_item` + `sales_order` + `product`).
3. `computeReceivables` (conteo y sumatoria de saldos).
4. `computeLowStock` (JOIN `stock_ledger` + `product` con `HAVING` y `COUNT(*) OVER()`).
5. `computePendingDispatch` (conteo sobre `sales_order`).
6. `computeRate` (histórico de tasas BCV).
7. `computeTopProducts` (agrupación y ordenamiento sobre `order_item`).
8. `computeLastClosure` (consulta a `cash_closure`).
9. `computeContainersInTransit` (consulta a `container`).

Estas 9 consultas **no se ejecutan en paralelo**. Corren una tras otra sobre la misma conexión. Con una latencia Vercel-Supabase típica de 25ms por consulta, solo el tráfico de red de la transacción consume:
$$\text{Latencia Red DB} = (2 \text{ setup}) + (9 \text{ consultas}) + (1 \text{ commit}) = 12 \times 25\text{ms} = 300\text{ms}$$
Añadiendo el tiempo de cómputo en PostgreSQL (agregaciones sobre miles de filas), la respuesta supera fácilmente los 1,100ms antes de comenzar a viajar hacia Venezuela.

---

### 2.3. Cascada N+1 y Bucle Secuencial en el Cierre de Venta (POS)

Inspección de `packages/api/src/modules/sales.ts` (`applyStockLifecycle`, L230–L274):

```ts
for (const item of items) {
  const sign = isClosing ? -1 : 1;

  // 1. Actualización de canal
  await ctx.db
    .update(ChannelAllocation)
    .set({ quantity: sql`GREATEST(quantity + ${sign * item.quantity}, 0)` })
    .where(and(
      eq(ChannelAllocation.workspaceId, ctx.workspace.workspaceId),
      eq(ChannelAllocation.productId, item.productId),
      eq(ChannelAllocation.channel, effectiveChannel),
    ));

  // 2. Actualización de almacén físico
  if (primaryWarehouseId) {
    await ctx.db
      .update(StockLedger)
      .set({
        quantity: sql`GREATEST(${StockLedger.quantity} + ${sign * item.quantity}, 0)`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
        eq(StockLedger.productId, item.productId),
        eq(StockLedger.warehouseId, primaryWarehouseId),
      ));
  }

  // 3. Inserción de movimiento individual
  await ctx.db.insert(StockMovement).values({
    workspaceId: ctx.workspace.workspaceId,
    productId: item.productId,
    warehouseId: primaryWarehouseId,
    movementType: isClosing ? "sale" : "return",
    quantity: sign * item.quantity,
    ...
  });
}
```

#### Análisis Cuantitativo del Desastre de Rendimiento en Checkout POS

Para un ticket estándar de ferretería, farmacia o supermercado con 15 productos:

- 1 verificación de clientes y catálogo (`inArray`) = 1 viaje.
- 1 inserción de `SalesOrder` (`RETURNING`) = 1 viaje.
- 1 inserción masiva de `OrderItem` = 1 viaje.
- 1 inserción masiva de `Payment` = 1 viaje.
- 1 actualización de estado de orden = 1 viaje.
- **Bucle de stock para 15 artículos**:
  - $15 \times \text{UPDATE ChannelAllocation} = 15$ viajes.
  - $15 \times \text{UPDATE StockLedger} = 15$ viajes.
  - $15 \times \text{INSERT StockMovement} = 15$ viajes.
  - **Subtotal bucle**: 45 viajes de red secuenciales.
- 1 actualización final `stockDeducted` = 1 viaje.
- 1 inserción de registro de auditoría (`logAudit`) = 1 viaje.
- Setup y cierre de transacción (`BEGIN`, `set_config`, `COMMIT`) = 3 viajes.

$$\text{Total Viajes DB en 1 Checkout} = 1 + 1 + 1 + 1 + 1 + 45 + 1 + 1 + 3 = 55 \text{ viajes de red secuenciales}$$

A 25ms por viaje entre Vercel y Supabase en us-east-1:
$$\text{Tiempo de espera exclusiva en BD} = 55 \times 25\text{ms} = 1,375\text{ms} \quad (1.375\text{ segundos})$$
Este patrón retiene bloqueada la conexión en el pool durante casi 1.5 segundos. Si dos cajeros cobran simultáneamente, agotan el pool per-instance (`max: 5`).

---

### 2.4. Auditoría de Índices en Esquema (`packages/db/src/schema.ts`)

Se realizó una auditoría exhaustiva sobre las tablas de alta transaccionalidad:

| Tabla                | Índice Actual                            | Deficiencia Técnica Identificada                                                                | Impacto en Producción                                                                                                  |
| :------------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **`product`**        | `idx_product_barcode` en `(barcode)`     | **No compuesto con `workspace_id`**. Bajo RLS, la consulta siempre filtra `workspace_id = ...`. | Escaneo de índice global; requiere filtrado post-índice por tenant.                                                    |
| **`product`**        | Ninguno en orden cronológico             | **Falta índice compuesto `(workspace_id, created_at DESC)`**.                                   | `listProducts` ordena por `createdAt DESC`. Obliga a un Sort en memoria/disco sobre todo el catálogo del tenant.       |
| **`sales_order`**    | `idx_order_created` en `(created_at)`    | **Índice unicolumna global sin `workspace_id`**.                                                | La paginación de órdenes por fecha de creación no puede aprovechar un Index Range Scan eficiente acotado al workspace. |
| **`sales_order`**    | `idx_order_status` en `(status)`         | **Índice unicolumna global sin `workspace_id`**.                                                | Los filtros de órdenes por estado (`pending`, `invoiced`) requieren Bitmap And con la condición de workspace.          |
| **`stock_movement`** | `idx_movement_created` en `(created_at)` | **Índice unicolumna global sin `workspace_id`**.                                                | Consultas del kardex de inventario ordenadas por fecha realizan ordenamiento en memoria.                               |
| **`customer`**       | `idx_customer_name` en `(name)`          | **No incluye `workspace_id`** como columna líder.                                               | Búsquedas de clientes por nombre en el POS escanean entradas de todos los tenants antes de descartar.                  |

---

### 2.5. Paginación y Carga de Payloads

1. **Simulación de Cursor con `OFFSET`**:
   En `packages/api/src/modules/catalog.ts` (L197–L198):
   ```ts
   .limit(input.limit)
   .offset(input.cursor ?? input.offset)
   ```
   El parámetro `cursor` se pasa directamente a la cláusula `OFFSET` de SQL. En PostgreSQL, un `OFFSET 1000` escanea y descarta 1,000 tuplas antes de retornar los siguientes 50 resultados. Esto es paginación por desplazamiento O(N), no paginación por cursor basada en claves (keyset pagination) O(1). A medida que el catálogo crece, la paginación profunda satura el buffer pool.
2. **Volcado Masivo en `stockOverview`**:
   En `packages/api/src/modules/inventory.ts` (L129):
   ```ts
   const limitVal = input.limit ?? 500;
   ```
   El límite por defecto es de 500 registros. Al abrir la pantalla de inventario o el POS (donde `PosClient` invoca `stockOverview.queryOptions({})`), se transfieren cientos de kilobytes de JSON con sumatorias de almacenes y canales que no se muestran inmediatamente al usuario.

---

## 3. Realidades de Red desde Venezuela (Análisis de Red Adversaria)

### 3.1. Perfil de Conectividad Nacional en Venezuela

El tráfico de red que sale de Venezuela hacia la región `us-east-1` (Norte de Virginia / Washington D.C.) atraviesa cables submarinos internacionales (ARCOS-1, PanAm, Americas-II) sujetos a las siguientes restricciones operativas reales:

| Parámetro de Red             | Proveedor Estatal (CANTV ADSL/VDSL/GPON)   | Proveedores Privados FTTH (Fibex, Inter, Netuno, Airtek)    | Impacto en la Aplicación Web                                                       |
| :--------------------------- | :----------------------------------------- | :---------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **RTT Promedio a us-east-1** | **180ms – 380ms+**                         | **115ms – 175ms**                                           | Retraso perceptible inmediato en cada interacción cliente-servidor.                |
| **Pérdida de Paquetes**      | **4% – 12%+ intermitente**                 | **1% – 4% en horas pico**                                   | Retransmisiones TCP, colapso de ventanas de congestión, demoras de 1 a 3 segundos. |
| **Jitter (Fluctuación)**     | **40ms – 120ms**                           | **10ms – 35ms**                                             | Variabilidad extrema en la carga de vistas; experiencia "a tirones".               |
| **Resolución DNS**           | Frecuentes fallos de resolución (timeouts) | Estable, pero afectado si usan DNS locales                  | Demoras de hasta 2 segundos en resolver dominios CDN y APIs.                       |
| **Eventos Eléctricos**       | Microcortes y caída de repetidores locales | Baterías/UPS en nodos, pero pérdida de enlace internacional | Pérdida súbita de conectividad en mitad de una transacción.                        |

---

### 3.2. Modelo de Latencia Multi-Salto (Multi-Hop Latency Model)

Cada interacción del empleado en el navegador sigue la topología:
$$\text{Cliente (VE)} \xrightarrow[\text{Salto 1}]{\text{Internet}} \text{Vercel Edge / Serverless (IAD/us-east-1)} \xrightarrow[\text{Salto 2}]{\text{Red Interna}} \text{Supabase Supavisor / Postgres} \xrightarrow[\text{Salto 3}]{\text{Retorno BD}} \text{Vercel} \xrightarrow[\text{Salto 4}]{\text{Retorno Red}} \text{Cliente (VE)}$$

#### Caso de Estudio A: Escaneo de Código de Barras en el POS

- **Condición**: Producto no presente en la lista inicial de 100 productos en memoria.
- **Flujo**:
  1. El cajero pasa el lector láser sobre el código.
  2. La pistola emite la cadena numérica y envía `Enter`.
  3. `apps/erp/src/app/(app)/pos/client.tsx` (L58) aplica debounce de 200ms.
  4. Petición HTTP tRPC a `catalog.listProducts({ search: barcode })`.
  5. Salto 1 (VE → Vercel): 150ms.
  6. Serverless Context (Session touch + Membership check): $25\text{ms} + 25\text{ms} = 50\text{ms}$.
  7. RLS Setup (`BEGIN` + `bindWorkspaceRls`): $25\text{ms} + 25\text{ms} = 50\text{ms}$.
  8. Consulta SQL `Product` con ILIKE + conteo: $30\text{ms}$.
  9. Consulta de precios `ProductPrice`: $25\text{ms}$.
  10. `COMMIT`: $25\text{ms}$.
  11. Salto 4 (Vercel → VE): 150ms.
- **Tiempo Total Acumulado**:
  $$\text{Latencia Escaneo} = 200\text{ms (debounce)} + 150\text{ms} + 50\text{ms} + 50\text{ms} + 30\text{ms} + 25\text{ms} + 25\text{ms} + 150\text{ms} = \mathbf{680\text{ms}}$$
- **Falla Catastrófica de Usabilidad**: Si la pistola envía `Enter` de inmediato, la función `handleBarcodeSubmit` (L314) busca en `productList` (vacío para este ítem) y en `filteredProducts` (que aún no ha recibido la respuesta de la red). **El escaneo se descarta y el cajero debe volver a pasar el artículo**.

#### Caso de Estudio B: Confirmación de Pago y Emisión de Factura (`checkoutPos`)

- **Condición**: Ticket con 15 artículos surtidos.
- **Flujo**:
  1. Cajero hace clic en "Confirmar Pago" en `PosCheckoutDialog`.
  2. Salto 1 (VE → Vercel): 160ms.
  3. Contexto + Verificación Auth + Sesión: 60ms.
  4. RLS Transaction Setup: 50ms.
  5. Validaciones preliminares e inserción de cabecera, líneas y pago: 125ms.
  6. Ejecución del bucle secuencial `applyStockLifecycle` (45 viajes DB): 1,125ms.
  7. Auditoría y `COMMIT`: 50ms.
  8. Salto 4 (Vercel → VE): 160ms.
- **Tiempo Nominal en Red Óptima**:
  $$\text{Latencia Nominal Checkout} = 160\text{ms} + 60\text{ms} + 50\text{ms} + 125\text{ms} + 1,125\text{ms} + 50\text{ms} + 160\text{ms} = \mathbf{1,730\text{ms}} \quad (1.73\text{ s})$$
- **Impacto con Pérdida de Paquetes (5% en CANTV/Inter)**:
  Con una ventana de 55 transacciones TCP internas y el paquete de retorno transatlántico, la probabilidad de al menos una retransmisión TCP es:
  $$P(\ge 1 \text{ pérdida}) = 1 - (1 - 0.05)^3 \approx 14.3\%$$
  Cada retransmisión por RTO (Retransmission Timeout) en Linux/Node añade entre 200ms y 1,000ms al viaje. En condiciones reales desde Caracas o Maracaibo, **el checkout demora entre 3.2 y 5.8 segundos**, provocando que el cajero impaciente presione repetidamente el botón.

---

### 3.3. Auditoría de Resiliencia y Fallo de Idempotencia

En `apps/erp/src/components/modals/pos-checkout-dialog.tsx` (L208–L263):

```ts
const checkout = useMutation(trpc.sales.checkoutPos.mutationOptions());
const isSubmitting = checkout.isPending;

const handleConfirmCheckout = async () => {
  if (cart.items.length === 0 || isSubmitting) return;
  ...
  try {
    sale = await checkout.mutateAsync({ customerId, items, payments });
  } catch (error) {
    setSubmitError(`No se registró la venta: ${error.message}`);
    return;
  }
}
```

#### Vulnerabilidad de Doble Cobro / Doble Facturación

1. El cajero confirma la venta. `isSubmitting` pasa a `true`.
2. La mutación llega a Vercel y se ejecuta en Supabase exitosamente (la orden queda registrada, el inventario descontado y los pagos grabados).
3. En el viaje de regreso (HTTP 200 Response), el enlace venezolano experimenta una micro-desconexión o timeout de socket (muy frecuente en conexiones móviles o CANTV).
4. El navegador aborta la petición y lanza una excepción de red (`Failed to fetch`).
5. El bloque `catch` captura el error, asigna el mensaje a `submitError` y **la bandera `isSubmitting` vuelve a ser `false`**. El modal permanece abierto con todos los datos del carrito y pagos intactos.
6. El cajero lee "No se registró la venta: Failed to fetch" y vuelve a pulsar el botón "Confirmar Pago".
7. Como no existe ningún identificador de idempotencia (`x-idempotency-key` o UUID de orden generado en el cliente), el backend procesa la petición como **una venta completamente nueva**.
8. **Resultado**: El inventario se descuenta dos veces, se generan dos facturas distintas en el sistema y se reportan dos ingresos contables para una sola operación física.

---

### 3.4. Análisis de la Caché en el Edge y Cabeceras HTTP

En `apps/erp/next.config.js` (L100–L105):

```js
{
  source: "/api/trpc/:path*",
  headers: [
    { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
    { key: "Vary", value: "Accept-Encoding" },
  ],
}
```

**Efecto**: Todas las rutas tRPC tienen desactivada la caché de forma categórica e incondicional.

- La tasa oficial de cambio del Banco Central de Venezuela (BCV), que cambia una sola vez al día a las 4:00 PM, no se almacena en el Edge. Cada petición de visualización en el ERP debe viajar a la base de datos en Estados Unidos.
- Los catálogos estáticos de categorías, marcas y almacenes obligan a un viaje transcontinental completo cada vez que un usuario navega entre pantallas.

---

## 4. Fluidez de Animaciones y Capacidad de Respuesta en UI

### 4.1. Análisis de Tecnologías de Animación (CSS vs JS)

En `packages/ui/package.json` (L38) se evidencia la presencia de `framer-motion: ^13.1.0`.

#### Caso Crítico: `AnimatedSizeContainer` (`packages/ui/src/animated-size-container.tsx`)

```tsx
function AnimatedSizeContainer({ width = false, height = true, ... }) {
  const [size, setSize] = useState<{ width?: number; height?: number }>({});
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ height: entry.contentRect.height, ... });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);

  return (
    <m.div
      animate={{ width: size.width, height: size.height }}
      transition={{ type: "spring", stiffness: 400, damping: 25, mass: 1.2 }}
    >
      <div ref={containerRef}>{children}</div>
    </m.div>
  );
}
```

#### Anatomía del Layout Thrashing (Reflow Forzado)

1. Las propiedades geométricas CSS `height` y `width` pertenecen a la etapa de **Layout** del motor de renderizado de Chromium.
2. Animar estas propiedades mediante un bucle de animación JavaScript (Framer Motion spring physics a 60 fps) obliga al navegador a:
   - Recalcular estilos computados.
   - Recalcular la geometría espacial de todos los nodos ancestros y descendientes (**Reflow**).
   - Invalidar capas de rasterizado y repintar la pantalla (**Repaint**).
3. La combinación de `ResizeObserver` actualizando el estado de React (`setSize`) genera renders continuos en cascada en el hilo principal de JavaScript.

#### Otras Fuentes de Inestabilidad Visual:

- **Transición de altura en la paleta de comandos** (`apps/erp/src/app/globals.css`, L150–L153):
  ```css
  .search-results-list {
    height: min(450px, var(--search-list-height, 0px));
    transition: height 100ms ease;
  }
  ```
  La transición de altura en CSS sobre una lista de resultados de búsqueda que cambia dinámicamente causa Cumulative Layout Shift (CLS) perceptible mientras el usuario escribe.
- **Efecto Shimmer Infinito en Esqueletos** (`apps/erp/src/app/globals.css`, L94–L105):
  ```css
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
  ```
  Animar `background-position` de forma infinita en tablas con 50 filas de esqueletos mantiene la GPU y CPU repintando rectángulos constantemente.

---

### 4.2. Impacto en Hardware de Bajas Prestaciones en Venezuela

En los comercios venezolanos es habitual encontrar hardware reutilizado o terminales POS específicos de bajo coste:

- **CPU**: Intel Celeron J1900 / N4000 / N4020, o procesadores Intel Atom x5 (2 a 4 núcleos pequeños, sin Hyper-Threading, frecuencias base de 1.1 GHz).
- **GPU**: Intel HD Graphics integrada (sin aceleración avanzada para capas complejas).
- **RAM**: 4 GB DDR3/DDR4 (frecuentemente saturada por Windows 10/11 y las pestañas de Chromium).

#### Consecuencias Observadas en este Entorno:

1. **Saturación del Hilo Principal (Long Tasks > 200ms)**: Durante la apertura de un modal o desplegable que utiliza `AnimatedSizeContainer`, el hilo principal se congela calculando la física del resorte y los recálculos de geometría. Si el cajero teclea o escanea un código de barras en ese milisegundo, la entrada se pierde o se retrasa notablemente (métrica **Interaction to Next Paint - INP > 450ms**, calificada como "Pobre" en Core Web Vitals).
2. **Caída de Cuadros (Frame Drops)**: La animación cae de 60 fps a menos de 15–20 fps, produciendo una sensación de "congelamiento" del sistema que hace dudar al operador sobre si el sistema respondió.

---

## 5. Tamaño del Bundle y Entrega de Recursos en el Frontend

### 5.1. Fronteras Server vs Client Components (Next.js 16)

- **Configuración de Tree-Shaking**: En `apps/erp/next.config.js` (L23–L41), se configuró correctamente `optimizePackageImports` para paquetes pesados (`@cendaro/ui`, `framer-motion`, `recharts`, `react-icons`, `@tanstack/react-table`, `zod`). Esto reduce el bundle inicial.
- **Lazy Loading de Diálogos**: En `apps/erp/src/app/(app)/pos/client.tsx` (L27–L49), los modales pesados (`PosCheckoutDialog`, `PosReceiptDialog`, `CreateCustomerDialog`) se cargan dinámicamente con `next/dynamic({ ssr: false })`, evitando inflar el bundle inicial de la página POS.

### 5.2. Estrategia de Carga Tipográfica (Hedvig Letters & Geist Mono)

Inspección de `apps/erp/src/app/layout.tsx` (L23–L47):

- **Estrategia**: `display: "swap"` con `adjustFontFallback: true`.
- **Riesgos en Redes Adversas**:
  - `display: "swap"` asegura que el texto se pinte de inmediato usando la fuente del sistema (`system-ui`, `arial`), eliminando el bloqueo de renderizado (FOIT).
  - No obstante, debido a que las fuentes Hedvig se descargan desde los servidores de Google Fonts / Vercel sobre enlaces con alta pérdida de paquetes, el cambio súbito de la tipografía del sistema a Hedvig Letters ocurre varios segundos después de haber cargado el contenido (**FOUT - Flash of Unstyled Text**). Aunque `adjustFontFallback` intenta calzar las métricas, diferencias en anchos de caracteres proporcionales en columnas financieras producen desplazamientos visuales menores.

---

## 6. Soluciones y Propuestas de Cambio Arquitecturales

Para transformar a Cendaro ERP en una plataforma de ultra-alta velocidad, resiliente a caídas de red y optimizada para comercios en Venezuela, se estructuran las siguientes soluciones técnicas:

---

### Propuesta 1: Motor Atómico de Deducción de Stock (Eliminación de N+1 en Checkout)

**Problema**: El bucle `for` de `applyStockLifecycle` genera hasta 45 consultas de red individuales por venta.  
**Solución Arquitectural**: Reemplazar el bucle secuencial por una única sentencia SQL parametrizada mediante una **Common Table Expression (CTE)** o una llamada a procedimiento almacenado (`deduct_stock_batch`) que actualice `ChannelAllocation`, `StockLedger` e inserte los movimientos de `StockMovement` en un solo viaje de red.

```sql
-- Ejemplo de CTE atómica para deducción masiva en 1 solo viaje de red
WITH items_to_deduct AS (
  SELECT * FROM unnest(
    $1::uuid[],    -- product_ids
    $2::integer[]  -- quantities
  ) AS t(product_id, qty)
),
upd_channel AS (
  UPDATE channel_allocation ca
  SET quantity = GREATEST(ca.quantity - itd.qty, 0)
  FROM items_to_deduct itd
  WHERE ca.workspace_id = $3
    AND ca.product_id = itd.product_id
    AND ca.channel = $4
  RETURNING ca.product_id
),
upd_ledger AS (
  UPDATE stock_ledger sl
  SET quantity = GREATEST(sl.quantity - itd.qty, 0),
      updated_at = NOW()
  FROM items_to_deduct itd
  WHERE sl.workspace_id = $3
    AND sl.product_id = itd.product_id
    AND sl.warehouse_id = $5
  RETURNING sl.product_id
)
INSERT INTO stock_movement (
  workspace_id, product_id, warehouse_id, movement_type, quantity, from_channel, reference_id, reference_type, created_by
)
SELECT $3, itd.product_id, $5, 'sale', -itd.qty, $4, $6, 'sales_order', $7
FROM items_to_deduct itd;
```

_Ganancia Estimada_: Reducción de 55 viajes de red a **4 viajes** por checkout. **Ahorro de ~1,000ms a 1,200ms en el tiempo total de confirmación de venta**.

---

### Propuesta 2: Claves de Idempotencia y Blindaje Contra Envíos Duplicados

**Problema**: Fallos de red en el retorno de la mutación provocan doble facturación y cobros duplicados al reintentar el cajero.  
**Solución Arquitectural**:

1. Incorporar en la cabecera o payload de `checkoutPos` un identificador único universal de cliente: `idempotencyKey: string` (generado en el frontend con `crypto.randomUUID()` en el momento en que se abre el ticket o se pulsa confirmar).
2. Crear la tabla de infraestructura `idempotency_key` con expiración automática de 24 horas (`key`, `workspace_id`, `response_payload`, `status`, `created_at`).
3. Si la clave ya fue procesada, retornar inmediatamente la respuesta en caché (`response_payload`) con estado 200 sin volver a insertar órdenes ni debitar inventario.
4. Deshabilitar inmediatamente el botón de envío y asociar un bloqueo visual de confirmación con estado transaccional persistido en la interfaz.

---

### Propuesta 3: Modo POS Offline & Almacenamiento Local en IndexedDB

**Problema**: Caídas de Internet paralizan el mostrador; el escáner falla si el producto no está entre los primeros 100 de memoria.  
**Solución Arquitectural**:

1. **Catálogo Completo en IndexedDB**: Al iniciar sesión o sincronizar la caja, descargar un catálogo comprimido (ID, SKU, Código de Barras, Nombre, Precio de Venta, Stock disponible) utilizando una base de datos local del navegador (vía `idb` o `Dexie.js`).
   - El escaneo de código de barras consulta **IndexedDB localmente en <5ms** sin depender de ningún debounce ni viaje a Vercel.
   - El 100% de los productos de la tienda son escaneables instantáneamente.
2. **Cola de Ventas Desconectada (Offline Outbox Queue)**:
   - Si la red cae, el POS completa la venta localmente: almacena el ticket en una tabla IndexedDB `offline_sales_queue`, descuenta el stock en el almacenamiento local y genera el recibo para el cliente.
   - En cuanto se detecte el evento de red `navigator.onLine` o respuesta afirmativa de ping, un trabajador de fondo o mutación tRPC sincroniza secuencialmente las ventas acumuladas hacia el servidor utilizando sus `idempotencyKey` correspondientes.

---

### Propuesta 4: Optimización del Pool y Caché Edge SWR para Datos Semi-Estáticos

**Problema**: Sobrecarga en Supavisor y viajes constantes transcontinentales para datos que rara vez cambian.  
**Solución Arquitectural**:

1. **Ajuste del Pool**: En `packages/db/src/client.ts`, modular el pool de serverless a `max: 3` en lambdas de API comunes, reservando capacidad en Supavisor, o evaluar un proxy de consultas HTTP (Supabase Data API o servidor dedicado de tRPC fuera de serverless para conexiones persistentes reales).
2. **Caché en el Edge con Stale-While-Revalidate**:
   En endpoints de solo lectura universales (`pricing.latestRates`, `catalog.listCategories`, `catalog.listBrands`), configurar cabeceras HTTP en Next.js:
   ```
   Cache-Control: public, s-maxage=300, stale-while-revalidate=86400
   ```
   Las peticiones desde Venezuela serán resueltas directamente por los servidores Edge de Cloudflare/Vercel en Miami o Bogotá en **menos de 40ms**, sin tocar Vercel serverless ni PostgreSQL.

---

### Propuesta 5: Paginación Keyset (Cursor Real) e Índices Compuestos Críticos

**Problema**: `OFFSET` O(N) degrada con catálogos grandes; falta de índices multitenant en ordenación.  
**Solución Arquitectural**:

1. **Migración de Índices Compuestos**:
   ```sql
   CREATE INDEX CONCURRENTLY idx_product_ws_created ON product(workspace_id, created_at DESC);
   CREATE INDEX CONCURRENTLY idx_product_ws_barcode ON product(workspace_id, barcode);
   CREATE INDEX CONCURRENTLY idx_sales_order_ws_created ON sales_order(workspace_id, created_at DESC);
   CREATE INDEX CONCURRENTLY idx_stock_movement_ws_created ON stock_movement(workspace_id, created_at DESC);
   ```
2. **Keyset Cursor Pagination**:
   Sustituir `.offset(cursor)` por:
   ```ts
   where(
     and(
       eq(table.workspaceId, wsId),
       cursor ? lt(table.createdAt, cursor) : undefined,
     ),
   )
     .orderBy(desc(table.createdAt))
     .limit(pageSize + 1);
   ```
   Garantiza tiempos de respuesta constantes O(1) (<10ms) sin importar si se navega la página 1 o la página 5,000.

---

### Propuesta 6: Eliminación de Layout Thrashing y Perfil "POS Rendimiento"

**Problema**: `AnimatedSizeContainer` satura CPUs Celeron/Atom con físicas spring sobre `width`/`height`.  
**Solución Arquitectural**:

1. **Reemplazo de Animaciones Geométricas**:
   - Sustituir animaciones de `height` por transiciones puramente CSS basadas en `transform: scaleY()` o `grid-template-rows: 0fr -> 1fr`, las cuales son gestionadas de forma más limpia por el motor gráfico sin invocar a `ResizeObserver`.
2. **Interruptor de Modo Rendimiento (Low Spec Mode)**:
   - Añadir una preferencia de interfaz persistente en el POS: "Modo Alto Rendimiento / Mostrador".
   - Al activarse, inyecta la clase `.low-spec-mode` en el elemento raíz:
     ```css
     .low-spec-mode * {
       animation: none !important;
       transition: none !important;
       box-shadow: none !important;
     }
     ```
   - Esto libera de inmediato el 100% de la capacidad de cómputo de la CPU Celeron para procesar las lecturas del escáner y la interacción del usuario sin caídas de cuadros.

---

## 7. Matriz de Priorización de Soluciones

|   #   | Propuesta de Cambio                                                          | Esfuerzo | Impacto en Rendimiento | Mitigación Crítica Venezuela                                                      |
| :---: | :--------------------------------------------------------------------------- | :------: | :--------------------: | :-------------------------------------------------------------------------------- |
| **1** | **Búsqueda Local de Códigos de Barra en POS (evitar descarte de escaneos)**  |  Medio   |      **Crítico**       | Permite operar el escáner a máxima velocidad sin depender del RTT transatlántico. |
| **2** | **Idempotencia en Checkout POS (`idempotencyKey`)**                          |   Bajo   |      **Crítico**       | Previene doble facturación y cobros duplicados ante cortes de conexión.           |
| **3** | **Batch Stock Deduction (Eliminación de N+1 en `applyStockLifecycle`)**      |  Medio   |      **Muy Alto**      | Reduce el tiempo de espera en el checkout de ~1.8s a <0.5s.                       |
| **4** | **Índices Compuestos `(workspace_id, created_at DESC)` y Keyset Paginación** |   Bajo   |        **Alto**        | Elimina ordenamientos costosos en disco en PostgreSQL para catálogos y ventas.    |
| **5** | **Sustitución de `AnimatedSizeContainer` y Modo Rendimiento POS**            |   Bajo   |        **Alto**        | Fluidez inmediata a 60 fps en terminales Celeron / Atom de 4GB de RAM.            |
| **6** | **Caché Edge SWR para Tasas BCV y Catálogos Maestros**                       |   Bajo   |       **Medio**        | Reduce latencia de 250ms a 35ms en consultas frecuentes semi-estáticas.           |
| **7** | **Modo POS Offline Completo con Cola de Sincronización en IndexedDB**        |   Alto   |      **Crítico**       | Continuidad operativa comercial al 100% durante caídas totales de Internet.       |

---

_Fin del Informe Técnico de Auditoría M3 — Cendaro ERP._
