# SheetJS–Next.js Integration Patterns for Cendaro

Cendaro-specific patterns showing how to combine SheetJS utilities with tRPC, Zod v4, and the existing project architecture.

---

## Pattern 1: Catalog Bulk Import

Upload an Excel file, validate with Zod, submit via tRPC mutation.

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";

import { FileUploader, SheetTable } from "~/components/xlsx";
import { api } from "~/trpc/client";

// 1. Define shape matching spreadsheet columns
interface CatalogRow {
  Referencia: string;
  Nombre: string;
  Precio: number;
  Categoria: string;
}

// 2. Zod schema for validation
const catalogRowSchema = z.object({
  Referencia: z.string().min(1),
  Nombre: z.string().min(1),
  Precio: z.number().positive(),
  Categoria: z.string().min(1),
});

export default function BulkImportPage() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [validated, setValidated] = useState<CatalogRow[]>([]);
  const mutation = api.catalog.bulkCreate.useMutation();

  const handleData = (data: CatalogRow[]) => {
    setRows(data);
    // Validate each row
    const valid: CatalogRow[] = [];
    const errors: string[] = [];
    data.forEach((row, i) => {
      const result = catalogRowSchema.safeParse(row);
      if (result.success) valid.push(result.data);
      else errors.push(`Fila ${i + 1}: ${result.error.message}`);
    });
    setValidated(valid);
    if (errors.length) toast.error(`${errors.length} filas con errores`);
  };

  const handleSubmit = () => {
    mutation.mutate(
      { products: validated },
      {
        onSuccess: () =>
          toast.success(`${validated.length} productos importados`),
      },
    );
  };

  return (
    <div>
      <FileUploader<CatalogRow> onData={handleData} />
      {rows.length > 0 && (
        <>
          <SheetTable rows={rows as Record<string, unknown>[]} maxRows={50} />
          <button onClick={handleSubmit} disabled={validated.length === 0}>
            Importar {validated.length} productos
          </button>
        </>
      )}
    </div>
  );
}
```

---

## Pattern 2: Client-Side Report Export

Query data via tRPC, let user download as Excel from the browser.

```tsx
"use client";

import { ExportButton } from "~/components/xlsx";
import { api } from "~/trpc/client";

export function SalesExport() {
  const { data: sales } = api.sales.list.useQuery({ limit: 1000 });

  return (
    <ExportButton rows={sales ?? []} filename="ventas.xlsx" sheetName="Ventas">
      ⬇ Exportar Ventas
    </ExportButton>
  );
}
```

---

## Pattern 3: Server-Side Route Handler Export

Database query → Excel response, served from a Next.js Route Handler.

```ts
// app/api/reports/catalog/route.ts
import { db } from "@cendaro/db/client";
import { products } from "@cendaro/db/schema";

import { xlsxResponse } from "~/lib/xlsx/server";

export async function GET() {
  const rows = await db
    .select({
      referencia: products.sku,
      nombre: products.name,
      precio: products.price,
      categoria: products.category,
    })
    .from(products);

  return xlsxResponse(rows, "catalogo.xlsx", "Catálogo");
}
```

---

## Pattern 4: Multi-Sheet Financial Report

Combine payments + receivables + summary into a single Excel download.

```tsx
"use client";

import { downloadMultiSheet } from "~/lib/xlsx/download";
import { api } from "~/trpc/client";

export function FinancialReport() {
  const { data: payments } = api.payments.list.useQuery();
  const { data: receivables } = api.receivables.list.useQuery();

  const handleExport = () => {
    if (!payments || !receivables) return;

    const summary = [
      {
        "Total Cobrado": payments.reduce((s, p) => s + p.amount, 0),
        "Total CxC": receivables.reduce((s, r) => s + r.balance, 0),
        Fecha: new Date().toLocaleDateString("es-VE"),
      },
    ];

    downloadMultiSheet(
      [
        { name: "Pagos", rows: payments },
        { name: "Cuentas por Cobrar", rows: receivables },
        { name: "Resumen", rows: summary },
      ],
      "reporte-financiero.xlsx",
    );
  };

  return <button onClick={handleExport}>📊 Reporte Financiero</button>;
}
```

---

## Pattern 5: Upload → Preview → Edit → Submit

Full workflow: user uploads, previews in table, edits inline, then submits.

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ExportButton, FileUploader, SheetTable } from "~/components/xlsx";

interface VendorRow {
  Nombre: string;
  RIF: string;
  Email: string;
  Telefono: string;
}

export default function VendorImport() {
  const [rows, setRows] = useState<VendorRow[]>([]);

  return (
    <div>
      {/* Step 1: Upload */}
      <FileUploader<VendorRow>
        onData={setRows}
        onError={(e) => toast.error(e.message)}
        label="Arrastra el archivo de proveedores"
      />

      {/* Step 2: Preview */}
      {rows.length > 0 && (
        <>
          <p>{rows.length} proveedores encontrados</p>
          <SheetTable
            rows={rows as Record<string, unknown>[]}
            columns={["Nombre", "RIF", "Email", "Telefono"]}
            maxRows={25}
          />

          {/* Step 3: Re-export (corrected data) */}
          <ExportButton rows={rows} filename="proveedores-verificados.xlsx">
            ⬇ Descargar verificados
          </ExportButton>
        </>
      )}
    </div>
  );
}
```
