---
name: sheetjs-nextjs
description: SheetJS xlsx utilities for Next.js App Router — typed parsing, browser export, server responses, and reusable React components. Use when building Excel/CSV import, export, preview, or report-generation features.
---

# SheetJS–Next.js Utilities

> **Trigger**: Use this skill when a task involves Excel/CSV file parsing, spreadsheet export, data preview tables, report generation, or bulk import/export workflows.

---

## 1. Overview

This skill provides a complete SheetJS integration layer for Next.js App Router projects, organized into four modules:

| Module                 | Environment | Purpose                               |
| ---------------------- | ----------- | ------------------------------------- |
| `lib/xlsx/workbook.ts` | Universal   | Core typed WorkBook ↔ JSON operations |
| `lib/xlsx/upload.ts`   | Client      | `File` → typed `T[]` parsers          |
| `lib/xlsx/download.ts` | Client      | Trigger browser `.xlsx` downloads     |
| `lib/xlsx/server.ts`   | Server only | Route Handler `Response` builders     |

Plus 3 React components: `FileUploader<T>`, `ExportButton<T>`, `MultiSheetExportButton`, `SheetTable`.

Reference source code is in `source/` within this skill directory.

---

## 2. Prerequisites

### Already installed in Cendaro

```
xlsx: ^0.18.5 (in @cendaro/erp)
```

### Critical rules

- **CDN install**: If reinstalling, use `pnpm add https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz --filter @cendaro/erp` — the npm registry `xlsx` is outdated and vulnerable.
- **Import path**: In `@cendaro/erp`, use `~/lib/xlsx` (NOT `@/lib/xlsx`). The project uses `~/` → `./src/*`.
- **Server isolation**: NEVER import `server.ts` in `"use client"` files — it uses `fs` and `path`.

---

## 3. Architecture — Client/Server Boundary

```
┌─────────────────────────────────────────────────────┐
│  BARREL: ~/lib/xlsx (index.ts)                      │
│  Exports: workbook + upload + download              │
│  ⚠️  Does NOT export server (tree-shaking safe)     │
└─────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  workbook.ts     │  │  upload.ts       │  │  download.ts     │
│  (Universal)     │  │  ("use client")  │  │  ("use client")  │
│                  │  │                  │  │                  │
│  parseWorkbook   │  │  fileToJson<T>   │  │  downloadAsXlsx  │
│  firstSheetToJson│  │  fileToAllSheets │  │  downloadWorkbook│
│  sheetToJson     │  │  fileToJsonWith  │  │  downloadMulti   │
│  jsonToWorkbook  │  │  Dates           │  │  workbookToBlob  │
│  buildMultiSheet │  └──────────────────┘  └──────────────────┘
│  aoaToWorkbook   │
│  workbookToBuffer│  ┌──────────────────────────────────────┐
│  autoFitColumns  │  │  server.ts (SERVER ONLY)             │
└──────────────────┘  │  Import: ~/lib/xlsx/server            │
                      │                                      │
                      │  readSheetFile                       │
                      │  xlsxResponse<T>                     │
                      │  xlsxMultiSheetResponse              │
                      └──────────────────────────────────────┘
```

---

## 4. Relationship with Existing Code

The project has `apps/erp/src/lib/parse-file-browser.ts` — a 3-Tier pipeline for packing list uploads:

- **Tier 1**: Raw `string[][]` extraction (no types)
- **Tier 2**: Row chunking to ≤2MB for Vercel payload limits
- **Tier 3**: JSZip image extraction for Groq Vision

**This skill does NOT replace that pipeline.** It provides complementary generic utilities:

- `parse-file-browser.ts` → packing-list-specific, raw rows, chunking, images
- `lib/xlsx/` → generic typed parsing, export, download, server responses

### When to use which

| Task                                                      | Use                                        |
| --------------------------------------------------------- | ------------------------------------------ |
| Packing list upload with images                           | `parse-file-browser.ts`                    |
| Generic typed spreadsheet import (catalog, vendors, etc.) | `~/lib/xlsx/upload` → `fileToJson<T>()`    |
| Client-side Excel download                                | `~/lib/xlsx/download` → `downloadAsXlsx()` |
| Server-side Excel response from Route Handler             | `~/lib/xlsx/server` → `xlsxResponse()`     |
| Data preview table after upload                           | `<SheetTable>` component                   |

---

## 5. Quick Start — Placing Files

When the agent needs to add these utilities to the project, copy from `source/` in this skill directory:

1. **Lib modules** → `apps/erp/src/lib/xlsx/` (5 files)
2. **Components** → `apps/erp/src/components/xlsx/` (4 files)
3. **Fix imports**: Replace all `@/` with `~/` in the copied files
4. **Add `"use client"` directives**: Ensure `upload.ts`, `download.ts`, and all components have `"use client"` at the top

---

## 6. Common Gotchas

| Error                          | Cause                                      | Fix                                                   |
| ------------------------------ | ------------------------------------------ | ----------------------------------------------------- |
| `Cannot find module 'fs'`      | Imported `server.ts` in a client component | Move import to Route Handler or Server Component      |
| Dates appear as serial numbers | Default SheetJS date handling              | Use `fileToJsonWithDates()` instead of `fileToJson()` |
| Same file can't be re-uploaded | Browser caches `<input>` value             | `FileUploader` already resets `e.target.value`        |
| `@/lib/xlsx` not found         | Wrong path alias                           | Use `~/lib/xlsx` in Cendaro                           |
| ESLint `Array<T>` syntax error | `@typescript-eslint/array-type` rule       | Use `T[]` syntax, not `Array<T>`                      |

---

## 7. Cendaro-Specific Rules

1. **Import style**: `import { fileToJson } from "~/lib/xlsx/upload"` or barrel `import { fileToJson } from "~/lib/xlsx"`
2. **Server imports**: `import { xlsxResponse } from "~/lib/xlsx/server"` — direct path, NOT through barrel
3. **Components**: Place in `apps/erp/src/components/xlsx/` — NOT in `@cendaro/ui` (xlsx is ERP-specific)
4. **tRPC integration**: Client-side parsing → pass typed data to tRPC mutation. Never send raw files to tRPC.
5. **Generic types**: Always pass `<T>` to parsing functions — never use `any`
6. **Zod validation**: After `fileToJson<T>()`, validate with Zod schema from `@cendaro/validators` before passing to tRPC
