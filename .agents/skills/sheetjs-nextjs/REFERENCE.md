# SheetJS–Next.js API Reference

Complete API reference for all exported functions and components.

---

## Lib: `~/lib/xlsx/workbook.ts` (Universal)

### `parseWorkbook(data: ArrayBuffer | Uint8Array): WorkBook`

Parse raw binary data into a SheetJS WorkBook object.

```ts
const wb = parseWorkbook(await file.arrayBuffer());
```

---

### `firstSheetToJson<T>(wb: WorkBook): T[]`

Extract typed row data from the first sheet of a workbook.

```ts
interface Product {
  Name: string;
  Price: number;
}
const products = firstSheetToJson<Product>(wb);
```

---

### `sheetToJson<T>(wb: WorkBook, sheetName: string): T[]`

Extract typed row data from a specific named sheet. **Throws** if sheet not found.

```ts
const q1Data = sheetToJson<SalesRow>(wb, "Q1 Sales");
```

---

### `jsonToWorkbook<T extends object>(rows: T[], sheetName?: string): WorkBook`

Build a single-sheet WorkBook from an array of objects. Default sheet name: `"Sheet1"`.

```ts
const wb = jsonToWorkbook(products, "Products");
```

---

### `buildMultiSheetWorkbook(sheets: { name: string; rows: object[] }[]): WorkBook`

Build a WorkBook with multiple named sheets.

```ts
const wb = buildMultiSheetWorkbook([
  { name: "Products", rows: products },
  { name: "Vendors", rows: vendors },
]);
```

---

### `aoaToWorkbook(data: unknown[][], sheetName?: string): WorkBook`

Build a WorkBook from an array-of-arrays (useful for custom headers or non-object data).

```ts
const aoa = [
  ["Header1", "Header2"],
  ["val1", "val2"],
];
const wb = aoaToWorkbook(aoa, "Custom");
```

---

### `workbookToBuffer(wb: WorkBook): Uint8Array`

Serialize a WorkBook to a `Uint8Array` buffer (for streaming, upload, or server response).

```ts
const buf = workbookToBuffer(wb);
```

---

### `autoFitColumns(ws: WorkSheet, rows: object[]): void`

Auto-fit column widths based on data content. Mutates the worksheet in place.

```ts
const ws = wb.Sheets[wb.SheetNames[0]];
autoFitColumns(ws, products);
```

---

## Lib: `~/lib/xlsx/upload.ts` (Client — `"use client"`)

### `fileToJson<T>(file: File): Promise<T[]>`

Read a `File` from `<input type="file">` and parse the first sheet into typed objects.

```ts
const products = await fileToJson<Product>(file);
```

---

### `fileToAllSheets(file: File): Promise<Record<string, unknown[]>>`

Parse ALL sheets from a file, returning a map of `{ sheetName: rows[] }`.

```ts
const allSheets = await fileToAllSheets(file);
// allSheets["Sheet1"], allSheets["Sheet2"], etc.
```

---

### `fileToJsonWithDates<T>(file: File): Promise<T[]>`

Parse a file with proper date deserialization. Use this when your spreadsheet contains date columns.

```ts
interface Order {
  Date: string;
  Amount: number;
}
const orders = await fileToJsonWithDates<Order>(file);
```

---

## Lib: `~/lib/xlsx/download.ts` (Client — `"use client"`)

### `downloadAsXlsx<T extends object>(rows: T[], filename?: string, sheetName?: string): void`

Trigger an immediate browser download of an `.xlsx` file from an array of objects.

```ts
downloadAsXlsx(products, "catalog-export.xlsx", "Products");
```

---

### `downloadWorkbook(wb: WorkBook, filename?: string): void`

Trigger a browser download from a pre-built WorkBook (for custom formatting).

```ts
const wb = jsonToWorkbook(data);
autoFitColumns(wb.Sheets[wb.SheetNames[0]], data);
downloadWorkbook(wb, "formatted-report.xlsx");
```

---

### `downloadMultiSheet(sheets: { name: string; rows: object[] }[], filename?: string): void`

Download a multi-sheet workbook in one call.

```ts
downloadMultiSheet(
  [
    { name: "Payments", rows: payments },
    { name: "Receivables", rows: receivables },
  ],
  "financial-report.xlsx",
);
```

---

### `workbookToBlob(wb: WorkBook): Blob`

Convert a WorkBook to a Blob. Useful for `fetch()` upload or `FormData`.

```ts
const blob = workbookToBlob(wb);
await fetch("/api/upload", { method: "POST", body: blob });
```

---

## Lib: `~/lib/xlsx/server.ts` (Server ONLY — Route Handlers, Server Components)

> ⚠️ **Never import this file in `"use client"` components.** It uses `fs` and `path`.

### `readSheetFile(relativePath: string): WorkBook`

Read a spreadsheet from the project filesystem (relative to `process.cwd()`).

```ts
const wb = readSheetFile("data/templates/invoice-template.xlsx");
```

---

### `xlsxResponse<T extends object>(rows: T[], filename?: string, sheetName?: string): Response`

Build a `Response` object that triggers an `.xlsx` download when returned from a Route Handler.

```ts
// app/api/export/route.ts
export async function GET() {
  const products = await db.query.products.findMany();
  return xlsxResponse(products, "catalog.xlsx", "Products");
}
```

---

### `xlsxMultiSheetResponse(sheets: { name: string; rows: object[] }[], filename?: string): Response`

Build a multi-sheet `.xlsx` `Response` for Route Handlers.

```ts
export async function GET() {
  const [payments, receivables] = await Promise.all([
    db.query.payments.findMany(),
    db.query.receivables.findMany(),
  ]);
  return xlsxMultiSheetResponse(
    [
      { name: "Pagos", rows: payments },
      { name: "CxC", rows: receivables },
    ],
    "financial-report.xlsx",
  );
}
```

---

## Components: `~/components/xlsx/`

### `<FileUploader<T>>`

Generic drag-and-drop file uploader that parses the first sheet.

```ts
interface Props<T> {
  onData: (rows: T[]) => void;
  onError?: (err: Error) => void;
  accept?: string; // default: ".xlsx,.xls,.csv"
  label?: string; // default: "Click or drag a spreadsheet here"
  className?: string;
}
```

```tsx
<FileUploader<Product>
  onData={(rows) => setProducts(rows)}
  onError={(e) => toast.error(e.message)}
  label="Arrastra un archivo Excel aquí"
/>
```

---

### `<ExportButton<T>>`

One-click client-side export button. Auto-disabled when `rows` is empty.

```ts
interface Props<T extends object> {
  rows: T[];
  filename?: string; // default: "export.xlsx"
  sheetName?: string; // default: "Sheet1"
  children?: ReactNode; // default: "Export to Excel"
  disabled?: boolean;
  className?: string;
}
```

```tsx
<ExportButton rows={filteredProducts} filename="catalog.xlsx">
  ⬇ Descargar Excel
</ExportButton>
```

---

### `<MultiSheetExportButton>`

Export multiple named sheets into a single file.

```ts
interface Props {
  sheets: { name: string; rows: object[] }[];
  filename?: string;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
}
```

```tsx
<MultiSheetExportButton
  sheets={[
    { name: "Ventas Q1", rows: q1Sales },
    { name: "Ventas Q2", rows: q2Sales },
  ]}
  filename="annual-sales.xlsx"
/>
```

---

### `<SheetTable>`

Auto-generates a preview table from parsed data. Columns derived from first row keys.

```ts
interface Props {
  rows: Record<string, unknown>[];
  maxRows?: number; // default: 100
  columns?: string[]; // override column order
  className?: string;
}
```

```tsx
<SheetTable
  rows={uploadedData as Record<string, unknown>[]}
  maxRows={50}
  columns={["Referencia", "Nombre", "Precio"]}
/>
```
