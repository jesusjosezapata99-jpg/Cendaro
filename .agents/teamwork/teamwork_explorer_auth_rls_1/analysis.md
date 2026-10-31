# Exhaustive Cybersecurity Audit Report

## Authentication, Multi-Tenancy Isolation, and Database Row-Level Security (RLS)

**Auditor**: Teamwork Cybersecurity Explorer Agent (`teamwork_explorer_auth_rls_1`)  
**Date**: 2026-10-31  
**Target Monorepo**: Cendaro ERP (`apps/erp`, `packages/api`, `packages/db`, `packages/auth`, `packages/validators`)  
**Database**: Supabase PostgreSQL (`ljwoptpaxazqmnhdczsb`)  
**Methodology**: Static Application Security Testing (SAST), Threat Modeling, Cryptographic & Authorization Matrix Verification, Empirical Database Schema & Migration Analysis

---

## Executive Summary

A deep security audit of the Cendaro ERP codebase was conducted focusing on Multi-Tenant Isolation, Supabase SSR Authentication & Session Management, Role-Based Access Control (RBAC), and Data Exfiltration Vectors.

The investigation verified that previous hardening efforts successfully closed public PostgREST API exposure (REVOKE ALL on public tables and sequences from `anon` and `authenticated`), established RLS on all 75 database tables in `packages/db/src/schema.ts`, removed authorization dependency on untrusted `user_metadata`, and wrapped mutating and reading tRPC procedures with `runInWorkspaceRls` and `runInWorkspaceRlsReadonly` (`SET LOCAL ROLE app_user` + InitPlan workspace GUC binding).

However, **critical and high-severity security vulnerabilities remain in the business logic layer and data authorization boundaries**:

1. **Critical Price Manipulation (CRIT-01)**: The POS checkout, sales order, and quotation procedures trust client-supplied `unitPrice` and `discount` without validating them against the official product catalog, minimum allowed price (`min_allowed`), or triggering executive approval workflows.
2. **High-Severity Data Exfiltration to Vendors (HIGH-01)**: `sales.listDeliveryNotes` and `sales.listInternalInvoices` are accessible to the `vendor` role under `orders.read`, but lack vendor-scoping filters, leaking customer addresses, competitor dispatch records, internal pricing, and line totals across the entire tenant.
3. **High-Severity Fiscal Document Emission & Tax Ledger Leakage (HIGH-02)**: SENIAT fiscal invoice/credit note emission and the complete Libro de Ventas tax ledger report are bound to generic `orders.create` and `orders.read`, allowing cashiers and vendors to emit official fiscal documents and exfiltrate all corporate revenue records.
4. **High-Severity Unapproved Credit Line Creation (HIGH-03)**: `createOrder` contains a logical flaw where customers with `creditLimit: 0` (no credit authorized) bypass the credit check and automatically receive a 30-day deferred credit line (`AccountReceivable`) without management approval.
5. **Medium-Severity Segregation of Duties Bypass (MED-01)**: `creditNotes.approve` permits the creator of a credit note to self-approve the document, automatically restoring stock and zeroing out Accounts Receivable balances without dual-control oversight.
6. **Medium-Severity Client-Side Role Desynchronization (MED-02)**: `users.me` returns the global `UserProfile.role` rather than the active workspace role (`workspace_member.role`), causing frontend navigation and UI role guards to misrepresent privileges in multi-tenant contexts.
7. **Low-Severity Session Management Deficiencies (LOW-01 & LOW-02)**: Missing cookie cleansing on logout for workspace context, and reliance on `getClaims()` without automatic token refresh in API/tRPC routes.

---

## Findings Matrix

| Finding ID      | Title                                                                                                    | Severity     | CWE / OWASP                         | Affected Component                                                              |
| :-------------- | :------------------------------------------------------------------------------------------------------- | :----------- | :---------------------------------- | :------------------------------------------------------------------------------ |
| **SEC-AUTH-01** | Arbitrary Unit Price & Discount Injection in Orders, Quotes, and POS Checkout                            | **CRITICAL** | CWE-20, CWE-863<br>OWASP A01 / A04  | `packages/api/src/modules/sales.ts`<br>`packages/api/src/modules/quotes.ts`     |
| **SEC-AUTH-02** | Horizontal Information Disclosure of Company-Wide Delivery Notes & Internal Invoices to Vendors          | **HIGH**     | CWE-285, CWE-200<br>OWASP A01:2021  | `packages/api/src/modules/sales.ts`<br>`packages/validators/src/authz.ts`       |
| **SEC-AUTH-03** | Low-Privilege Roles Can Emit SENIAT Fiscal Documents & Exfiltrate Full Tax Ledger (Libro de Ventas)      | **HIGH**     | CWE-285, CWE-863<br>OWASP A01:2021  | `packages/api/src/modules/fiscal.ts`<br>`packages/validators/src/authz.ts`      |
| **SEC-AUTH-04** | Automatic 30-Day Credit Line Creation on Walk-In / Zero-Credit Customers                                 | **HIGH**     | CWE-639, CWE-863<br>OWASP A01 / A04 | `packages/api/src/modules/sales.ts`                                             |
| **SEC-AUTH-05** | Segregation of Duties Bypass in Credit Note Approval Workflow                                            | **MEDIUM**   | CWE-284, CWE-653<br>OWASP A01:2021  | `packages/api/src/modules/credit-notes.ts`                                      |
| **SEC-AUTH-06** | Client-Side Role Desynchronization via Global `UserProfile.role` vs Multi-Tenant `workspace_member.role` | **MEDIUM**   | CWE-284, CWE-1021<br>OWASP A04:2021 | `packages/api/src/modules/users.ts`<br>`apps/erp/src/hooks/use-current-user.ts` |
| **SEC-AUTH-07** | Incomplete Session Cookie Cleansing on Logout                                                            | **LOW**      | CWE-613, CWE-384<br>OWASP A07:2021  | `apps/erp/src/app/api/auth/logout/route.ts`                                     |
| **SEC-AUTH-08** | Missing Automatic Refresh Token Rotation in SSR API Routes (`getClaims()` vs `getUser()`)                | **LOW**      | CWE-613, CWE-287<br>OWASP A07:2021  | `apps/erp/src/proxy.ts`<br>`apps/erp/src/app/api/trpc/[...trpc]/route.ts`       |

---

## Detailed Technical Findings

### Finding SEC-AUTH-01: Arbitrary Unit Price & Discount Injection in Orders, Quotes, and POS Checkout

- **Finding ID**: SEC-AUTH-01
- **Severity**: **CRITICAL** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N — Score 6.5, Business Impact: Catastrophic)
- **Classification**: CWE-20 (Improper Input Validation), CWE-863 (Incorrect Authorization), OWASP A01:2021-Broken Access Control, OWASP A04:2021-Insecure Design
- **Affected Components**:
  - `packages/api/src/modules/sales.ts`: Lines 1030–1115 (`createOrder`), Lines 1299–1378 (`checkoutPos`), Lines 357–365 (`posCheckoutInputSchema`)
  - `packages/api/src/modules/quotes.ts`: Lines 148–196 (`create`), Lines 334–360 (`convertToOrder`)
- **Vulnerability Details**:
  In `sales.createOrder`, `sales.checkoutPos`, and `quotes.create`, the schema allows the caller to submit `unitPrice` and `discount` directly:
  ```typescript
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      discount: z.number().nonnegative().default(0),
    }),
  );
  ```
  The server calculates total amounts by simply multiplying the client-submitted values:
  ```typescript
  const subtotal = input.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const totalDiscount = input.items.reduce(
    (sum, i) => sum + i.discount * i.quantity,
    0,
  );
  const total = subtotal - totalDiscount;
  ```
  The server verifies that the product exists in the workspace and is not locked/discontinued, but **never verifies whether `unitPrice` matches the configured price in `ProductPrice` or respects `min_allowed`**, nor does it check if excessive discounts require approval (`approvalType: "discount_override"` or `"price_override"`).
- **Exploitation Scenario**:
  1. An employee or cashier at a retail location sells a premium product with a list price of $500.00.
  2. The cashier intercepts or crafts a tRPC call to `sales.checkoutPos` setting `unitPrice: 0.01` and `discount: 0`.
  3. The server computes `total: 0.01`. The cashier registers a cash payment of $0.01.
  4. The order is automatically marked as `invoiced`, and `applyStockLifecycle` deducts the real physical inventory from `StockLedger`.
  5. The cashier walks away with $500.00 worth of merchandise having legally paid 1 cent according to system records.
  6. Alternatively, a national vendor (`vendor`) creates a quote with `unitPrice: 0.01`, calls `quotes.convertToOrder`, and generates a confirmed order at 99.9% below market price.
- **Remediation Recommendation**:
  1. **Server-Side Price Resolution**: Remove `unitPrice` from the required client payload in `createOrder` and `checkoutPos`. Fetch the official active price from `ProductPrice` joined by `channel` / `PriceList` for the workspace.
  2. **Price Override Approval**: If custom pricing or manual discounts are permitted, validate that `unitPrice >= ProductPrice.minAllowedPrice`. If the price is below minimum or if `discount > maxAllowedDiscount`, require an approved `approvalId` with `approvalType = "price_override"` from an active manager/admin.
  3. **Quote Conversion Verification**: In `quotes.convertToOrder`, re-validate line items against catalog pricing and enforce expiration dates before instantiating `SalesOrder` and `OrderItem`.

---

### Finding SEC-AUTH-02: Horizontal Information Disclosure of Company-Wide Delivery Notes & Internal Invoices to Vendors

- **Finding ID**: SEC-AUTH-02
- **Severity**: **HIGH** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N — Score 6.5)
- **Classification**: CWE-285 (Improper Authorization), CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor), OWASP A01:2021-Broken Access Control
- **Affected Components**:
  - `packages/api/src/modules/sales.ts`: Lines 1563–1612 (`listDeliveryNotes`), Lines 1732–1782 (`listInternalInvoices`)
  - `packages/validators/src/authz.ts`: Line 128
  - `packages/validators/src/index.ts`: Lines 144–145 (`NAV_ROLE_RULES`)
- **Vulnerability Details**:
  In `packages/validators/src/authz.ts`, the `orders` module grants read access to `vendor`:
  ```typescript
  orders: managed({
    create: [...SALES_FLOOR, "vendor"],
    read: [...SALES_FLOOR, "vendor"],
    update: SALES_FLOOR,
  });
  ```
  `listDeliveryNotes` and `listInternalInvoices` are declared with:
  ```typescript
  listDeliveryNotes: wsReadPermissionProcedure("orders", "read");
  listInternalInvoices: wsReadPermissionProcedure("orders", "read");
  ```
  In PostgreSQL, RLS only partitions data by `workspace_id`. Inside a workspace, vendor row-level scoping relies on application-level filtering (`vendorScopeId(ctx)`). However, `listDeliveryNotes` and `listInternalInvoices` only filter by `eq(DeliveryNote.workspaceId, ctx.workspace.workspaceId)`. They completely omit vendor-scoping checks.
- **Exploitation Scenario**:
  1. A commission-based sales agent with the `vendor` role authenticates to the ERP.
  2. The web frontend hides the "Facturas" and "Notas de Entrega" menu items because `NAV_ROLE_RULES.invoices` and `deliveryNotes` exclude `"vendor"`.
  3. The vendor sends a direct tRPC HTTP request: `POST /api/trpc/sales.listInternalInvoices` and `sales.listDeliveryNotes`.
  4. The server authorizes the request because the vendor role has `orders.read`.
  5. The response leaks all internal invoices and delivery notes across all vendors, revealing confidential client lists, home/business addresses, recipient national ID numbers (RIF/Cédula), negotiated line prices, competitor vendor sales volumes, and delivery routes.
- **Remediation Recommendation**:
  1. In `packages/api/src/modules/sales.ts`, apply `vendorScopeId(ctx)` in `listDeliveryNotes` and `listInternalInvoices`:
     ```typescript
     const vendorId = vendorScopeId(ctx);
     if (vendorId) {
       // Join SalesOrder and restrict to orders created by this vendor or assigned customers
       conditions.push(eq(SalesOrder.createdBy, vendorId));
     }
     ```
  2. Separate permissions in `packages/validators/src/authz.ts`: Declare distinct ERP modules or actions for `delivery_notes` and `invoices` restricted strictly to `MANAGEMENT` (`owner`, `admin`, `supervisor`).

---

### Finding SEC-AUTH-03: Low-Privilege Roles Can Emit SENIAT Fiscal Documents & Exfiltrate Full Tax Ledger (Libro de Ventas)

- **Finding ID**: SEC-AUTH-03
- **Severity**: **HIGH** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N — Score 8.1)
- **Classification**: CWE-285 (Improper Authorization), CWE-863 (Incorrect Authorization), OWASP A01:2021-Broken Access Control
- **Affected Components**:
  - `packages/api/src/modules/fiscal.ts`: Lines 170–270 (`emitDocument`), Lines 390–455 (`salesBookReport`)
  - `packages/validators/src/authz.ts`: Lines 115–163
- **Vulnerability Details**:
  In `packages/api/src/modules/fiscal.ts`, the SENIAT fiscal emission procedure and tax reporting procedure are mapped to generic `orders` permissions:
  ```typescript
  emitDocument: wsPermissionProcedure("orders", "create");
  salesBookReport: wsReadPermissionProcedure("orders", "read");
  ```
  Both `orders.create` and `orders.read` are assigned to `employee` and `vendor`.
  - `emitDocument` creates binding legal documents (Facturas Fiscales, Notas de Débito, Notas de Crédito) with arbitrary `fiscalInvoiceNumber`, `controlNumber`, `buyerRif`, and `exchangeRateBcv`.
  - `salesBookReport` queries `FiscalDocument` for the entire workspace and computes complete taxable bases, 16% IVA, 8% IVA, 3% IGTF, and tax retentions.
- **Exploitation Scenario**:
  1. A low-privilege retail employee or third-party vendor calls `trpc.fiscal.salesBookReport.query()`.
  2. The server dumps the company's entire historical SENIAT Libro de Ventas: total corporate gross revenue, tax liabilities, customer fiscal data, and currency transaction ratios.
  3. A rogue cashier calls `trpc.fiscal.emitDocument.mutation(...)` supplying custom invoice numbers and control numbers, emitting fraudulent SENIAT tax receipts or manipulating fiscal credit note balances.
- **Remediation Recommendation**:
  1. Introduce a dedicated `fiscal` module in `packages/validators/src/authz.ts`:
     ```typescript
     fiscal: managed({
       create: ADMINS, // Only owner and admin may emit official fiscal tax documents
       read: MANAGEMENT, // Supervisor, admin, owner
       update: ADMINS,
       delete: ADMINS,
     });
     ```
  2. Change procedure builders in `fiscal.ts`:
     - `emitDocument`: `wsPermissionProcedure("fiscal", "create")`
     - `salesBookReport`: `wsReadPermissionProcedure("fiscal", "read")`
     - `listDocuments`: `wsReadPermissionProcedure("fiscal", "read")`

---

### Finding SEC-AUTH-04: Automatic 30-Day Credit Line Creation on Walk-In / Zero-Credit Customers

- **Finding ID**: SEC-AUTH-04
- **Severity**: **HIGH** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N — Score 6.5)
- **Classification**: CWE-639 (Authorization Bypass Through User-Controlled Key), CWE-863 (Incorrect Authorization), OWASP A01:2021-Broken Access Control
- **Affected Components**:
  - `packages/api/src/modules/sales.ts`: Lines 1141–1150 and Lines 1191–1209 (`createOrder`)
- **Vulnerability Details**:
  In `sales.createOrder`, the credit limit check is gated behind:
  ```typescript
  if (
    customerRow &&
    typeof customerRow.creditLimit === "number" &&
    customerRow.creditLimit > 0 &&
    (customerRow.balance ?? 0) + total > customerRow.creditLimit + MONEY_EPSILON
  ) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "..." });
  }
  ```
  If a customer has `creditLimit: 0` or `null` (the default for walk-in retail buyers or customers without approved credit), `customerRow.creditLimit > 0` evaluates to `false`. The entire limit validation is skipped.
  Subsequently, lines 1191–1209 execute:
  ```typescript
  if (order && input.customerId && total > 0) {
    const creditDays =
      typeof customerRow?.creditDays === "number" && customerRow.creditDays > 0
        ? customerRow.creditDays
        : 30; // Defaults to 30 days!
    const dueDate = new Date(Date.now() + creditDays * 86_400_000);
    await ctx.db.insert(AccountReceivable).values({
      workspaceId: ctx.workspace.workspaceId,
      customerId: input.customerId,
      orderId: order.id,
      totalAmount: total,
      paidAmount: 0,
      balance: total,
      status: "pending",
      dueDate,
      notes: `Generado por pedido ${effectiveOrderNumber}`,
      createdBy: ctx.user.id,
    });
  }
  ```
- **Exploitation Scenario**:
  1. An employee creates an order for a walk-in customer whose profile has `creditLimit: 0`.
  2. The employee does not register any payments.
  3. The system accepts the order, defaults `creditDays` to 30, and creates an open `AccountReceivable` entry with zero payments.
  4. Merchandise is released without payment, bypassing the required executive approval for credit sales (`approvalType: "credit_sale"`).
- **Remediation Recommendation**:
  1. In `createOrder`, if `!customerRow?.creditLimit || customerRow.creditLimit <= 0`:
     - Reject creating an order with an unpaid balance unless payment is provided immediately, OR
     - Require a formal `credit_sale` approval request in `Approval` resolved by an owner or admin before the order can be confirmed.
  2. Never default unapproved credit days to 30 days when `creditDays <= 0`.

---

### Finding SEC-AUTH-05: Segregation of Duties Bypass in Credit Note Approval Workflow

- **Finding ID**: SEC-AUTH-05
- **Severity**: **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N — Score 6.5)
- **Classification**: CWE-284 (Improper Access Control), CWE-653 (Improper Adherence to Separation of Duties), OWASP A01:2021-Broken Access Control
- **Affected Components**:
  - `packages/api/src/modules/credit-notes.ts`: Lines 344–460 (`approve`)
  - Compare with: `packages/api/src/modules/approvals.ts`: Lines 116–118
- **Vulnerability Details**:
  In `approvals.ts`, the system rigorously enforces segregation of duties:
  ```typescript
  if (approval.requestedBy === userId && !openedByServer) {
    throw new TRPCError({ code: "FORBIDDEN", message: ownRequestMessage });
  }
  ```
  However, `creditNotesRouter.approve` in `credit-notes.ts` implemented its own parallel approval logic. While it verifies that the caller has role `owner`, `admin`, or `supervisor`, **it never checks `note.requestedBy !== ctx.user.id`**.
- **Exploitation Scenario**:
  1. A supervisor creates a credit note for $5,000 via `creditNotes.create`.
  2. The same supervisor immediately invokes `creditNotes.approve({ id: note.id })`.
  3. The credit note is approved and applied without a second reviewer.
  4. The system automatically restores inventory to warehouse stock, decrements the customer's Accounts Receivable balance, and authorizes cash/transfer refunds without independent manager sign-off.
- **Remediation Recommendation**:
  1. In `creditNotesRouter.approve`, insert an explicit segregation-of-duties invariant:
     ```typescript
     if (note.requestedBy === ctx.user.id && ctx.workspace.role !== "owner") {
       throw new TRPCError({
         code: "FORBIDDEN",
         message:
           "Segregación de funciones: no puedes aprobar una nota de crédito solicitada por ti mismo.",
       });
     }
     ```
  2. Add row-level locking (`.for("update")`) when querying `CreditNote` during approval to prevent concurrent double-application races.

---

### Finding SEC-AUTH-06: Client-Side Role Desynchronization via Global `UserProfile.role` vs Multi-Tenant `workspace_member.role`

- **Finding ID**: SEC-AUTH-06
- **Severity**: **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N — Score 5.4)
- **Classification**: CWE-284 (Improper Access Control), CWE-1021 (Client-Side State Inconsistency), OWASP A04:2021-Insecure Design
- **Affected Components**:
  - `packages/api/src/modules/users.ts`: Lines 94–101 (`me: selfProcedure`)
  - `apps/erp/src/hooks/use-current-user.ts`: Lines 40–58
  - `apps/erp/src/app/(app)/app-shell.tsx`: Line 90
  - `apps/erp/src/components/role-guard.tsx`: Lines 41, 73
- **Vulnerability Details**:
  The database schema stores user identity globally in `user_profile` and tenant membership in `workspace_member`. The backend authorization layer correctly derives roles exclusively from `workspace_member.role` (via `is_workspace_member()`).
  However, `users.me` uses `selfProcedure` and returns the raw `user_profile` table record, which still contains a legacy `role` column (`UserProfile.role`).
  In the Next.js frontend, `useCurrentUser` sets:
  ```typescript
  role: profile.role, // from users.me
  ```
  All frontend UI guards (`role-guard.tsx`, navigation menus, button disablement) evaluate `profile.role` instead of the user's role in the _active workspace_.
- **Exploitation Scenario**:
  - **Scenario A (Privilege Inflation in UI)**: An individual is an `"owner"` in Workspace 1 (their profile has `role = "owner"`). They are invited to Workspace 2 as an `"employee"`. In Workspace 2, the client renders the full owner administration interface, audit panels, and management buttons. While tRPC mutations fail on the server, the user sees internal management views and layouts.
  - **Scenario B (Denial of Functionality in UI)**: An individual is registered as an `"employee"` in Workspace 1. In Workspace 2, they are promoted to `"admin"`. The UI remains locked in `"employee"` mode because `users.me` returns `role: "employee"`, blocking access in the browser.
- **Remediation Recommendation**:
  1. Modify `users.me` or `workspace.current` to return `workspaceRole` resolved from the active workspace context:
     ```typescript
     // In workspace.current or a dedicated session endpoint:
     role: ctx.workspace.role,
     ```
  2. Refactor `apps/erp/src/hooks/use-current-user.ts` to source `role` from the active workspace context (`trpc.workspace.current` or `x-workspace-id` resolution) rather than `UserProfile.role`.
  3. Deprecate and drop the `role` column from `public.user_profile` in database migrations.

---

### Finding SEC-AUTH-07: Incomplete Session Cookie Cleansing on Logout

- **Finding ID**: SEC-AUTH-07
- **Severity**: **LOW** (CVSS:3.1/AV:L/AC:L/PR:L/UI:R/S:U/C:L/I:L/A:N — Score 3.3)
- **Classification**: CWE-613 (Insufficient Session Expiration), CWE-384 (Session Fixation), OWASP A07:2021-Identification and Authentication Failures
- **Affected Components**:
  - `apps/erp/src/app/api/auth/logout/route.ts`: Lines 88–103
- **Vulnerability Details**:
  In `apps/erp/src/app/api/auth/logout/route.ts`, the handler executes:
  ```typescript
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json(
    { success: true },
    { status: 200, headers: AUTH_SECURITY_HEADERS },
  );
  ```
  While Supabase auth access/refresh cookies are invalidated, the custom session state cookies:
  - `cendaro-workspace-id` (Workspace selector state)
  - `cendaro-last-activity` (Idle session tracking cookie)
    are **not deleted** in the response.
- **Exploitation Scenario**:
  On a shared point-of-sale terminal or workstation, Cashier A logs out. When Cashier B logs in, the stale `cendaro-workspace-id` cookie persists. If Cashier B belongs to different workspaces or if the login lookup encounters a transient blip, Cashier B's session operates under Cashier A's residual workspace context.
- **Remediation Recommendation**:
  Explicitly delete the custom cookies on logout:
  ```typescript
  const response = NextResponse.json(
    { success: true },
    { status: 200, headers: AUTH_SECURITY_HEADERS },
  );
  response.cookies.delete("cendaro-workspace-id");
  response.cookies.delete("cendaro-last-activity");
  return response;
  ```

---

### Finding SEC-AUTH-08: Missing Automatic Refresh Token Rotation in SSR API Routes (`getClaims()` vs `getUser()`)

- **Finding ID**: SEC-AUTH-08
- **Severity**: **LOW** (CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:N/A:L — Score 3.1)
- **Classification**: CWE-613 (Insufficient Session Expiration), CWE-287 (Improper Authentication), OWASP A07:2021-Identification and Authentication Failures
- **Affected Components**:
  - `apps/erp/src/proxy.ts`: Line 65 (`if (pathname.startsWith("/api/")) return NextResponse.next();`), Line 135 (`supabase.auth.getClaims()`)
  - `apps/erp/src/app/api/trpc/[...trpc]/route.ts`: Lines 106–110
- **Vulnerability Details**:
  In Next.js App Router, `proxy.ts` excludes `/api/*` to avoid redundant auth verification:
  ```typescript
  if (pathname.startsWith("/api/")) return NextResponse.next();
  ```
  Inside `/api/trpc/[...trpc]/route.ts`, authentication is performed solely via:
  ```typescript
  const { data } = await supabase.auth.getClaims();
  user = mapClaimsToUser(data?.claims);
  ```
  `getClaims()` verifies the JWT signature locally using cached JWKS. However, **`getClaims()` does NOT execute refresh token exchange**. Standard Supabase SSR middleware relies on `supabase.auth.getUser()`, which automatically exchanges expired access tokens for new ones and sets `Set-Cookie` headers.
  If an operator remains on a single-page application (such as the POS terminal or Catalog grid) for >60 minutes without triggering a full page reload, the access token expires. All subsequent background tRPC mutations and queries immediately fail with `401 UNAUTHORIZED`, even though a valid refresh token exists in the browser cookies.
- **Exploitation Scenario**:
  Cashiers processing long retail queues or operators executing bulk imports experience abrupt mid-operation failures and data loss after 60 minutes due to expired access tokens that are never refreshed by the API handler.
- **Remediation Recommendation**:
  In `/api/trpc/[...trpc]/route.ts`, if `getClaims()` returns no claims (token expired) and cookies contain a refresh token, perform a fallback call to `supabase.auth.getUser()`, allowing `@supabase/ssr` to refresh the session and attach updated cookies to the tRPC HTTP response.

---

## Multi-Tenant Database RLS & Schema Analysis

### Table-by-Table RLS Assessment

An automated audit of all **75 database tables** defined in `packages/db/src/schema.ts` confirmed:

- **75 of 75 tables (100%)** have `.enableRLS()` declared.
- **66 tables** enforce workspace isolation via the factory:
  ```sql
  CREATE POLICY "<table_name>_workspace_isolation" ON public."<table_name>"
  AS PERMISSIVE FOR ALL TO app_user
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
  ```
- **4 tables** have `.enableRLS()` with **0 policies** (`organization`, `rate_limit_bucket`, `rate_limit_lockout`, `user_session_activity`). Under PostgreSQL RLS semantics, a table with RLS enabled and zero policies **fails closed (default-deny for all rows)** for non-superuser roles (`app_user`, `anon`, `authenticated`). This is architecturally sound, as these tables are accessed exclusively by `postgres` / `service_role`.
- **5 tables** use customized security policies:
  1. `user_profile`: Scoped to members of the active workspace via `EXISTS (SELECT 1 FROM workspace_member ...)`.
  2. `workspace`: Scoped via `id = (SELECT current_setting('app.workspace_id', true))::uuid`.
  3. `audit_log`: WORM policy (allows `SELECT` and `INSERT` scoped to workspace; forbids `UPDATE` and `DELETE`).
  4. `permission` & `role_permission`: System reference tables (`SELECT` allowed to `app_user`).

### Database Role Boundary Audit

```
┌────────────────────────────────────────────────────────┐
│ Client Connection Pool (DATABASE_URL)                  │
│ Role: postgres (BYPASSRLS)                             │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ Self / System Queries   │ │ Workspace Procedures    │
│ (users.me, list, etc.)  │ │ (wsPermissionProcedure) │
│ Role: postgres          │ │ Role: app_user (RLS ON) │
│ RLS Bypassed            │ │ GUC: app.workspace_id   │
└─────────────────────────┘ └─────────────────────────┘
```

The database connection pool connects as `postgres`. When a request enters `wsPermissionProcedure` or `wsReadPermissionProcedure`, the connection executes:

```sql
SELECT set_config('role', 'app_user', true), set_config('app.workspace_id', $1, true)
```

This drops privileges to `app_user` for the duration of the transaction.
**Key Architectural Caveat**: Procedures that use `selfProcedure` (such as `users.me`, `workspace.list`, `workspace.create`) run directly on the pooled connection as `postgres`. Therefore, any query executed inside a `selfProcedure` **completely bypasses PostgreSQL Row-Level Security** and depends 100% on manual `WHERE user_id = ctx.user.id` filters in Drizzle ORM.

---

## Remediation Roadmap

### Phase 1: Immediate Critical Fixes (Day 1–2)

1. **Catalog Price Enforcement (SEC-AUTH-01)**:
   - In `packages/api/src/modules/sales.ts` (`createOrder`, `checkoutPos`) and `quotes.ts` (`create`), remove unverified client `unitPrice` and `discount`.
   - Calculate prices on the server by looking up `ProductPrice` and enforcing `min_allowed`.
2. **Vendor Scope Enforcement (SEC-AUTH-02)**:
   - In `sales.ts`, add `vendorScopeId(ctx)` filtering to `listDeliveryNotes` and `listInternalInvoices`.
   - Block vendors from viewing sales, pricing, and dispatch details of other agents.

### Phase 2: Authorization & Fiscal Hardening (Day 3–4)

3. **Fiscal RBAC Segregation (SEC-AUTH-03)**:
   - Define the `fiscal` module in `packages/validators/src/authz.ts`.
   - Rebind `emitDocument` to `fiscal.create` (owner/admin only) and `salesBookReport` to `fiscal.read` (management only).
4. **Credit Policy Enforcement (SEC-AUTH-04)**:
   - Update `createOrder` to reject deferred credit receivables for customers with `creditLimit <= 0` unless an explicit `credit_sale` approval has been granted.
5. **Segregation of Duties Enforcement (SEC-AUTH-05)**:
   - Add self-approval rejection and `FOR UPDATE` locking in `creditNotes.approve`.

### Phase 3: Identity & Session Lifecycle Hardening (Day 5)

6. **Workspace-Scoped Role Resolution in Frontend (SEC-AUTH-06)**:
   - Refactor `useCurrentUser` in `apps/erp` to consume the role from the active workspace context (`trpc.workspace.current`) rather than global `UserProfile.role`.
7. **Session Cookie Cleanup & Refresh Rotation (SEC-AUTH-07, SEC-AUTH-08)**:
   - Clear `cendaro-workspace-id` and `cendaro-last-activity` in `logout/route.ts`.
   - Implement refresh-token fallback in `apps/erp/src/app/api/trpc/[...trpc]/route.ts`.

---

## Verification & Independent Audit Commands

To verify the findings and confirm the authorization coverage across the monorepo:

```bash
# 1. Verify procedure authorization coverage (ensure all procedures declare meta.authz)
pnpm -F @cendaro/api test -- run src/__tests__/procedure-authz-coverage.test.ts

# 2. Verify RLS coverage and InitPlan policy structure across all tables
pnpm -F @cendaro/api test -- run src/__tests__/rls-coverage.test.ts

# 3. Verify role RBAC matrix rules and execution per role
pnpm -F @cendaro/api test -- run src/modules/roles-rbac.test.ts

# 4. Verify no authorization logic reads user_metadata
pnpm -F @cendaro/api test -- run src/__tests__/metadata-role-escalation.test.ts

# 5. Full workspace type check across all packages
pnpm typecheck
```
