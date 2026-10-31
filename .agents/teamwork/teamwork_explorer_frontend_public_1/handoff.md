# Handoff Report: Frontend, SSR/RSC Data Exposure & Public Attack Vectors

**Agent**: `teamwork_explorer_frontend_public_1`  
**Milestone**: `frontend_public_security_audit`  
**Handoff Type**: Hard Handoff (Investigation & Threat Modeling Complete)  
**Target Path**: `c:\Users\jzs99\Desktop\TEST\.agents\teamwork\teamwork_explorer_frontend_public_1\handoff.md`  
**Detailed Report**: `c:\Users\jzs99\Desktop\TEST\.agents\teamwork\teamwork_explorer_frontend_public_1\analysis.md`

---

## 1. Observation

Direct empirical observations collected via read-only source inspection, git logs, and compilation manifests:

1. **Next.js Middleware Manifest is Completely Empty:**
   - Command: `view_file` on `apps/erp/.next/server/middleware-manifest.json`
   - Content:
     ```json
     {
       "version": 3,
       "middleware": {},
       "sortedMiddleware": [],
       "functions": {}
     }
     ```
   - Next.js constants in `apps/erp/node_modules/next/dist/lib/constants.js`:
     `MIDDLEWARE_FILENAME: 'middleware'`, `MIDDLEWARE_LOCATION_REGEXP: '(?:src/)?middleware'`.
   - In commit `a404a93ccb3e04a4448f2102e81921f18f82c8e3`, `apps/erp/src/middleware.ts` was renamed to `apps/erp/src/proxy.ts`, and the export was renamed to `export async function proxy(request: NextRequest)` (line 21). Next.js never executes `proxy.ts`.

2. **Unauthenticated Page Shell Render on Prefetch Failure:**
   - In `apps/erp/src/app/(app)/layout.tsx` lines 22-29:
     ```typescript
     try {
       await Promise.all([
         queryClient.prefetchQuery(trpc.users.me.queryOptions()),
         queryClient.prefetchQuery(trpc.workspace.list.queryOptions()),
         queryClient.prefetchQuery(trpc.pricing.latestRates.queryOptions()),
       ]);
     } catch {
       // Prefetch failure is non-critical — client will fetch on hydration
     }
     return (
       <Providers initialWorkspaceId={workspaceId} dehydratedState={dehydrate(queryClient)}>
         <AppShell>{children}</AppShell>
       </Providers>
     );
     ```
   - Because middleware does not redirect unauthenticated users to `/login`, `AppLayout` catches prefetch failures silently and renders the full authenticated shell layout `<AppShell>` to an anonymous requester.

3. **Sensitive Cost Averages and Supplier Purchase Costs Serialized in RSC Payloads:**
   - In `packages/api/src/modules/catalog.ts` lines 276-330 (`productById`):
     ```typescript
     const [product] = await ctx.db.select().from(Product).where(...).limit(1);
     ...
     const [..., productSuppliers] = await Promise.all([
       ...,
       ctx.db.select().from(ProductSupplier).where(eq(ProductSupplier.productId, input.id)),
     ]);
     return { ...product, attributes, prices, stockLedger, channelAllocations, uomEquivalences, productSuppliers };
     ```
   - In `packages/db/src/schema.ts`:
     - Line 997: `costAvg: t.numeric({ precision: 12, scale: 4 }).default("0")` (Weighted average inventory cost).
     - Line 1105: `cost: t.doublePrecision()` (Raw supplier purchase cost).
   - In `packages/validators/src/authz.ts` line 118: `catalog: managed({ read: EVERYONE })`. Roles like `employee`, `vendor`, and `marketing` have `catalog:read` permission.
   - In `apps/erp/src/app/(app)/catalog/[id]/page.tsx` lines 35-59:
     `await queryClient.prefetchQuery(trpc.catalog.productById.queryOptions({ id }));`
     `<HydrationBoundary state={dehydrate(queryClient)}>` serializes both `Product.costAvg` and `ProductSupplier.cost` into the HTML/RSC payload sent to the browser.

4. **Missing Vendor Scoping in Fiscal Invoice Listing:**
   - In `packages/api/src/modules/fiscal.ts` lines 154-167:
     ```typescript
     listInvoices: wsReadPermissionProcedure("orders", "read")
       .query(async ({ ctx, input }) => {
         const wsId = ctx.workspace.workspaceId;
         const conditions = [eq(FiscalDocument.workspaceId, wsId)];
         ...
         return ctx.db.select().from(FiscalDocument).where(and(...conditions))...;
       });
     ```
   - In `packages/validators/src/authz.ts` line 130: `orders.read` includes `vendor`.
   - In `fiscal.ts`, unlike `sales.ts:479` (`vendorScopeId(ctx)`), there is NO filter on `assignedVendorId` or order ownership.

5. **Spreadsheet Formula Injection in Export Utilities:**
   - In `apps/erp/src/lib/xlsx/workbook.ts` lines 26-34:
     ```typescript
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
   - Zero sanitization of formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`) occurs before calling `utils.json_to_sheet()`. In `apps/erp/src/modules/receiving/inventory-import/steps/result-summary.tsx` line 54, `downloadAsXlsx(rows, ...)` writes raw error strings and cell content to `.xlsx`.

6. **Browser Zip Bomb Vulnerability in Client Image Extraction:**
   - In `apps/erp/src/lib/parse-file-browser.ts` lines 242-258 (`extractImagesFromXlsx`):
     ```typescript
     const zip = await JSZip.loadAsync(buffer);
     ...
     for (const [path, zipFile] of Object.entries(zip.files)) {
       ...
       const blob = await zipFile.async("blob");
     }
     ```
   - No checks on `Object.keys(zip.files).length` or total uncompressed byte size before decompression in the browser thread.

7. **CSP Policy Wildcard and Inline Execution:**
   - In `apps/erp/csp.mjs` lines 24-38:
     - `script-src 'self' 'unsafe-inline' ...`
     - `img-src 'self' data: blob: https://*.supabase.co`
     - `connect-src 'self' ... https://*.supabase.co https://*.sentry.io https://challenges.cloudflare.com`

8. **CSRF / Same-Origin Check Omission on tRPC and AI Routes:**
   - `isTrustedOrigin` (`apps/erp/src/lib/trusted-origin.ts`) is enforced in `apps/erp/src/app/api/auth/create-user/route.ts:99` and `apps/erp/src/app/api/auth/logout/route.ts:47`, but is absent in `apps/erp/src/app/api/trpc/[...trpc]/route.ts` and `apps/erp/src/app/api/ai/parse-packing-list/route.ts`.

---

## 2. Logic Chain

1. **Edge Route Protection Failure (SEC-FE-01)**:
   - Next.js strictly resolves middleware based on `MIDDLEWARE_FILENAME = 'middleware'`.
   - `apps/erp/src/middleware.ts` does not exist; only `apps/erp/src/proxy.ts` exists.
   - Therefore, Next.js build emits an empty middleware manifest (`middleware: {}`).
   - Consequently, in runtime deployments, Next.js executes zero middleware checks, completely bypassing authentication redirects and idle timeouts for page routes.

2. **Confidential Business Data Leakage (SEC-FE-02)**:
   - The authorization matrix (`packages/validators/src/authz.ts`) explicitly hides pricing and margins from non-management roles (`pricing:read` is restricted to `MANAGEMENT`).
   - `catalog.productById` uses `select().from(Product)` and `select().from(ProductSupplier)`, which return `costAvg` and `cost`.
   - `catalog:read` is granted to `EVERYONE` (including `employee`, `vendor`, `marketing`).
   - In Next.js App Router, `prefetchQuery` followed by `<HydrationBoundary state={dehydrate(queryClient)}>` embeds the query result directly into the HTML document stream.
   - Therefore, any non-management employee or sales rep viewing a product detail page receives the internal cost price and supplier cost in the serialized client-side payload.

3. **Horizontal Tenant / Vendor Data Leakage (SEC-FE-03)**:
   - The `vendor` role is granted `orders.read` in `authz.ts`.
   - `fiscal.listInvoices` is gated by `orders.read`, but omits `vendorScopeId(ctx)` filtering.
   - Therefore, any sales rep can query `/invoices` and retrieve customer RIFs, addresses, and sales numbers belonging to other sales reps across the organization.

4. **Formula Execution via Exported Spreadsheets (SEC-FE-04)**:
   - `downloadAsXlsx` calls `utils.json_to_sheet` without sanitizing cell prefixes.
   - Excel and LibreOffice interpret cells starting with `=`, `+`, `-`, or `@` as executable formula syntax.
   - Therefore, opening an exported error list or catalog file containing untrusted input executes formulas on the administrator's desktop machine.

5. **Exfiltration Channel via CSP (SEC-FE-06)**:
   - CSP defines `connect-src ... https://*.supabase.co`.
   - Supabase allows any user to create an arbitrary project with a subdomain under `supabase.co`.
   - Therefore, an injected script could transmit stolen session data to an attacker-owned Supabase database without triggering a CSP violation.

---

## 3. Caveats

- **Production Database Modifications**: No dynamic testing involving database writes or token tampering was executed against the production database `ljwoptpaxazqmnhdczsb`, per repository rules and integrity mode. All findings are derived from static analysis, AST inspection, git archaeology, and local build artifacts.
- **Third-Party Upstream Dependencies**: SheetJS is pinned to version 0.20.3 via CDN tarball in `package.json`; no internal source code modifications to SheetJS itself were evaluated.
- **Vercel Edge Environment**: The behavior of Vercel edge reverse proxies regarding `x-forwarded-for` header sanitization depends on Vercel deployment configuration, though client-side spoofing was noted as a potential risk factor.

---

## 4. Conclusion

The ERP frontend architecture incorporates strong security patterns in certain areas (such as constant-time login flows, composite IP/username rate limiters, strict redirect allowlists, and `@t3-oss/env-nextjs` variable isolation). However, **a critical naming defect rendered the entire Next.js Edge Middleware inoperative**, leaving authenticated ERP routes exposed to unauthenticated shell rendering. In addition, unescaped database fields in SSR/RSC prefetch payloads expose internal cost structures to non-management staff and allow vendor cross-visibility into SENIAT fiscal invoices.

All 8 vulnerabilities are cataloged with CVSS scores, line numbers, and actionable step-by-step remediation plans in `analysis.md`. Remediation must begin with re-establishing `apps/erp/src/middleware.ts` and scoping `catalog.productById` and `fiscal.listInvoices`.

---

## 5. Verification Method

To independently verify these findings, run the following commands and inspect the referenced files:

1. **Verify Edge Middleware Inoperativity (SEC-FE-01)**:
   - Check middleware manifest output:
     ```powershell
     pnpm --filter @cendaro/erp exec node -e "const m = require('./.next/server/middleware-manifest.json'); console.log(m);"
     ```
   - Confirm that `middleware` is empty `{}` and `sortedMiddleware` is `[]`.
   - Verify Next.js filename expectation:
     ```powershell
     pnpm --filter @cendaro/erp exec node -e "const { MIDDLEWARE_FILENAME } = require('next/dist/lib/constants'); console.log(MIDDLEWARE_FILENAME);"
     ```
   - Confirms `MIDDLEWARE_FILENAME: 'middleware'`.

2. **Verify Cost Leakage in `catalog.productById` (SEC-FE-02)**:
   - Inspect `packages/api/src/modules/catalog.ts` lines 276-330 and confirm `Product.costAvg` and `ProductSupplier.cost` are selected and returned without role checks.
   - Check `packages/validators/src/authz.ts` line 118: confirm `catalog: managed({ read: EVERYONE })`.

3. **Verify Missing Vendor Scope in `fiscal.listInvoices` (SEC-FE-03)**:
   - Inspect `packages/api/src/modules/fiscal.ts` lines 154-167: confirm that `vendorScopeId` is not present in the query conditions, while present in `packages/api/src/modules/sales.ts:479`.

4. **Verify Formula Injection in Excel Export (SEC-FE-04)**:
   - Inspect `apps/erp/src/lib/xlsx/workbook.ts` lines 26-34 and confirm `jsonToWorkbook` directly passes rows to `utils.json_to_sheet(rows)` with no formula prefix check.

5. **Verify CSP Wildcard (SEC-FE-06)**:
   - Inspect `apps/erp/csp.mjs` line 34: confirm `https://*.supabase.co` in `connect-src`.
