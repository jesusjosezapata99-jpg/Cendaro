# Comprehensive Cybersecurity Audit & Threat Modeling Report: API Layer, Financial & Pricing Logic, and Transaction Integrity

**Project**: Cendaro ERP  
**Target Repository**: `packages/api`, `packages/validators`, `packages/db`  
**Auditor**: `teamwork_explorer_pricing_api_1` (Deep Cybersecurity Explorer Agent)  
**Date**: 2026-10-31  
**Scope**: tRPC Routers, Financial & Pricing Logic, Transaction Concurrency, State Machine Transitions, and Data Integrity  
**Status**: Completed (Read-Only Audit Phase)

---

## Executive Summary

A comprehensive source-code and architectural security audit was conducted targeting the API layer (tRPC routers), financial calculations, pricing pipelines, inventory lifecycle mechanisms, and transaction integrity across Cendaro ERP.

The audit identified **15 critical, high, and medium severity vulnerabilities** spanning:

1. **Critical Price & Financial Manipulation**: The server unconditionally accepts client-supplied unit prices, inverted discounts, unverified credit note prices, and client-supplied exchange rates without authoritatively looking up or recalculating prices from the product catalog or rates engine.
2. **Authorization & Segregation of Duties Bypasses**: Critical financial adjustments (such as 100% VAT and 34% ISLR tax retentions reducing Accounts Receivable) can be executed by frontline employees without manager oversight, and credit notes can bypass the required executive approval chain.
3. **Concurrency & Race Conditions**: Stock deductions in sales orders and POS checkouts use non-locking clamp queries (`GREATEST(qty - delta, 0)`), permitting concurrent overselling and negative stock depletion. Payment submissions and purchase receipts lack idempotency controls and unique constraints, allowing double-credit and stock duplication attacks.
4. **State Machine & Mass Assignment Risks**: Sales orders can transition directly from unpaid drafts to `delivered`, instantly deducting showroom/warehouse stock without payment verification.

---

## Summary Matrix of Findings

| Finding ID      | Title                                                                            | Severity     | OWASP 2021                     | CWE              | Affected Component                                                         |
| :-------------- | :------------------------------------------------------------------------------- | :----------- | :----------------------------- | :--------------- | :------------------------------------------------------------------------- |
| **SEC-API-001** | Client-Supplied Unit Prices and Discounts in Orders and POS Checkout             | **CRITICAL** | A04: Insecure Design           | CWE-472, CWE-20  | `packages/api/src/modules/sales.ts:1031-1115`, `1300-1405`                 |
| **SEC-API-002** | Inverted/Unlimited Discounts & Negative Total Orders via Quote Conversion        | **CRITICAL** | A04: Insecure Design           | CWE-840, CWE-20  | `packages/api/src/modules/quotes.ts:148-246`, `286-403`                    |
| **SEC-API-003** | Arbitrary Unit Prices, Inflated Tax & Fake Exchange Rates in Credit Notes        | **CRITICAL** | A01: Broken Access Control     | CWE-472, CWE-20  | `packages/api/src/modules/credit-notes.ts:110-265`, `344-498`              |
| **SEC-API-004** | Client-Controlled Exchange Rate and Unlinked Line Items in Fiscal Documents      | **HIGH**     | A04: Insecure Design           | CWE-472, CWE-20  | `packages/api/src/modules/fiscal.ts:170-274`                               |
| **SEC-API-005** | IEEE-754 Floating-Point Drift in Financial Math and DB Schema Columns            | **MEDIUM**   | A04: Insecure Design           | CWE-682          | `packages/api/src/modules/sales.ts:1106-1114`, `packages/db/src/schema.ts` |
| **SEC-API-006** | Credit Note Direct Approval Bypass Without Executive Workflow Verification       | **HIGH**     | A01: Broken Access Control     | CWE-862          | `packages/api/src/modules/credit-notes.ts:344-400`, `approvals.ts:311-316` |
| **SEC-API-007** | Frontline Employee Accounts Receivable Balance Erasure via Unchecked Retentions  | **HIGH**     | A01: Broken Access Control     | CWE-863, CWE-285 | `packages/api/src/modules/fiscal.ts:277-372`                               |
| **SEC-API-008** | Vendor Row Scoping Bypass via Omission of Customer ID                            | **MEDIUM**   | A01: Broken Access Control     | CWE-639          | `packages/api/src/modules/vendor-scope.ts:32-57`, `sales.ts:1047`          |
| **SEC-API-009** | Inventory Overselling and Silent Clamping Without Concurrency Row Locks          | **HIGH**     | A04: Insecure Design           | CWE-362, CWE-840 | `packages/api/src/modules/sales.ts:261-317`                                |
| **SEC-API-010** | Duplicate Payment Submission & Order Over-Crediting Race Condition               | **HIGH**     | A04: Insecure Design           | CWE-362, CWE-20  | `packages/api/src/modules/payments.ts:113-181`, `schema.ts:2031-2068`      |
| **SEC-API-011** | Inventory Multi-Injection and Replay Attack in Container Receipt                 | **HIGH**     | A04: Insecure Design           | CWE-362, CWE-840 | `packages/api/src/modules/containers.ts:140-300`                           |
| **SEC-API-012** | Uncontrolled Purchase Receipt Repetition & Weighted Cost Distortion              | **MEDIUM**   | A04: Insecure Design           | CWE-20, CWE-840  | `packages/api/src/modules/inventory.ts:1166-1280`                          |
| **SEC-API-013** | Unrestricted Order State Transitions to "Delivered" Without Payment Verification | **HIGH**     | A01: Broken Access Control     | CWE-840, CWE-285 | `packages/api/src/modules/sales.ts:1227-1290`                              |
| **SEC-API-014** | Missing `.strict()` Schema Enforcement on Financial Mutators                     | **LOW**      | A08: Software & Data Integrity | CWE-915          | `packages/validators/src/index.ts`, `sales.ts`, `catalog.ts`               |
| **SEC-API-015** | Disconnect Between Payments Router and Accounts Receivable Balance               | **MEDIUM**   | A04: Insecure Design           | CWE-840          | `packages/api/src/modules/payments.ts:156-166`, `receivables.ts:39-152`    |

---

## Detailed Vulnerability Findings

### 1. Focus Area: Price Manipulation & Financial Integrity

#### SEC-API-001: Client-Supplied Unit Prices and Discounts in Orders and POS Checkout

- **Severity**: **CRITICAL** (CVSS 9.8 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H)
- **OWASP Classification**: A04:2021 – Insecure Design / A01:2021 – Broken Access Control
- **CWE Classification**: CWE-472 (Reliance on Untrusted Inputs in a Security Decision), CWE-20 (Improper Input Validation)
- **Affected Component**:
  - `packages/api/src/modules/sales.ts`: Lines 1031–1115 (`createOrder`)
  - `packages/api/src/modules/sales.ts`: Lines 1300–1405 (`checkoutPos`)
  - `packages/validators/src/index.ts`: Lines 188–198 (`createOrderSchema`)
- **Vulnerability Details & Mechanism**:
  In both `sales.createOrder` and `sales.checkoutPos`, line items accept `unitPrice` and `discount` directly from the client request payload:
  ```typescript
  // packages/api/src/modules/sales.ts:1037-1043
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      discount: z.number().nonnegative().default(0),
    }),
  );
  ```
  The procedures verify that `productId` exists in the workspace catalog, but **never query or verify the price against the database table `ProductPrice`**. The subtotal and total calculations directly multiply the client's supplied `unitPrice`:
  ```typescript
  // packages/api/src/modules/sales.ts:1106-1114
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
- **Exploitation Scenario**:
  1. An attacker (or a compromised employee/vendor with `orders.create` or `pos.create` permissions) opens the POS or calls the tRPC procedure `sales.checkoutPos`.
  2. The cart contains high-value equipment worth $5,000 (e.g., an industrial generator or high-end smartphone).
  3. The client overrides the item input to `{ productId: "...", quantity: 1, unitPrice: 0.01, discount: 0 }`.
  4. The calculated total is $0.01. The attacker tenders a 1-cent payment.
  5. The server records the transaction as fully paid, sets status to `invoiced`, emits an order number, executes `applyStockLifecycle` which deducts the physical product from the showroom inventory, and logs the sale. The physical item is legally cleared out for $0.01.
- **Technical Remediation Recommendation**:
  1. Refactor `sales.createOrder` and `sales.checkoutPos` schemas so that `unitPrice` is either omitted or strictly advisory.
  2. Query `ProductPrice` on the server using `(workspaceId, productId, priceType)` (where `priceType` is resolved based on sales channel: store/retail or wholesale).
  3. Authoritatively compute `unitPrice = dbPrice.amountUsd`.
  4. Restrict line discounts to a server-side maximum percentage policy (e.g., max 10% without supervisor approval). If discount exceeds the policy threshold, require an `Approval` entity before the sale can be confirmed or checked out.

---

#### SEC-API-002: Inverted/Unlimited Discounts & Negative Total Orders via Quote Conversion

- **Severity**: **CRITICAL** (CVSS 9.1 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-840 (Business Logic Error), CWE-20 (Improper Input Validation)
- **Affected Component**:
  - `packages/api/src/modules/quotes.ts`: Lines 148–246 (`quotes.create`)
  - `packages/api/src/modules/quotes.ts`: Lines 286–403 (`quotes.convertToOrder`)
- **Vulnerability Details & Mechanism**:
  In `packages/api/src/modules/sales.ts:1049`, a guard exists: `if (input.items.some((i) => i.discount > i.unitPrice)) throw ...`.
  However, in `packages/api/src/modules/quotes.ts:148-214`, **this guard is completely absent**:
  ```typescript
  // packages/api/src/modules/quotes.ts:188-196
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
  If `discount > unitPrice`, `total` becomes a **negative number**.
  When the quotation is accepted, `quotes.convertToOrder` executes:
  ```typescript
  // packages/api/src/modules/quotes.ts:352-354
  subtotal: quote.subtotal,
  discount: quote.discount ?? 0,
  total: quote.total,
  ```
  It copies the negative `total` into `SalesOrder.total`. Because `total < 0`, the customer credit limit check in `sales.createOrder` (`if (input.customerId && total > 0)`) is entirely bypassed, and no positive debt is recorded in Accounts Receivable.
- **Exploitation Scenario**:
  1. A vendor or sales agent calls `quotes.create` with `unitPrice: 10` and `discount: 1000`.
  2. The quote is created with `total: -990`.
  3. The agent calls `quotes.convertToOrder({ id })`.
  4. An order with total `-$990` is inserted into `SalesOrder`.
  5. When subsequent orders or refunds reconcile against the order, the negative balance creates a credit balance or corrupts financial reports (`reporting.reconcileFinancialLedger`), stealing funds or draining inventory without balance checks.
- **Technical Remediation Recommendation**:
  1. Add strict validation in `packages/api/src/modules/quotes.ts`:
     ```typescript
     if (input.items.some((i) => i.discount > i.unitPrice)) {
       throw new TRPCError({
         code: "BAD_REQUEST",
         message: "El descuento no puede superar el precio unitario",
       });
     }
     ```
  2. In `quotes.convertToOrder`, assert that `quote.total > 0` before inserting into `SalesOrder`.
  3. Enforce a PostgreSQL `CHECK (total >= 0)` constraint on `sales_order` and `quote` tables in `packages/db/src/schema.ts`.

---

#### SEC-API-003: Arbitrary Unit Prices, Inflated Tax & Fake Exchange Rates in Credit Notes

- **Severity**: **CRITICAL** (CVSS 9.1 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H)
- **OWASP Classification**: A01:2021 – Broken Access Control / A04:2021 – Insecure Design
- **CWE Classification**: CWE-472 (Reliance on Untrusted Inputs), CWE-20 (Improper Input Validation)
- **Affected Component**:
  - `packages/api/src/modules/credit-notes.ts`: Lines 110–265 (`creditNotes.create`)
  - `packages/api/src/modules/credit-notes.ts`: Lines 344–498 (`creditNotes.approve`)
- **Vulnerability Details & Mechanism**:
  In `creditNotes.create`, the schema accepts client-supplied financial values:
  ```typescript
  // packages/api/src/modules/credit-notes.ts:118-129
  exchangeRateBcv: z.number().positive().default(1),
  taxUsd: z.number().min(0).default(0),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPriceUsd: z.number().min(0).optional(),
    }),
  )
  ```
  The code verifies that `line.quantity <= maxReturnable` (preventing returning more units than billed), but for pricing it executes:
  ```typescript
  // packages/api/src/modules/credit-notes.ts:247
  const unitPriceUsd = roundMoney2(line.unitPriceUsd ?? billed.unitPrice);
  ```
  **There is no check that `line.unitPriceUsd <= billed.unitPrice`!**
  The client can pass `unitPriceUsd: 50000.00` on an item that was billed at $10.00. Furthermore, `taxUsd` is taken directly from input without calculation, and `exchangeRateBcv` is taken directly from input without checking the `ExchangeRate` table.
  When approved, `creditNotes.approve` performs:
  ```typescript
  // packages/api/src/modules/credit-notes.ts:478-482
  const creditAmount = Number(note.totalUsd);
  const newBalance = Math.max(0, roundMoney2(currentBalance - creditAmount));
  ```
- **Exploitation Scenario**:
  1. A customer owes $5,000 on an open invoice for 100 items purchased on credit.
  2. A compromised user calls `creditNotes.create` returning 1 single item, but specifies `unitPriceUsd: 5000.00` (instead of the billed $10.00).
  3. Once approved, the $5,000 credit note is applied against the customer's `AccountReceivable.balance`, completely eliminating the $5,000 debt while returning only 1 single $10 unit of stock.
- **Technical Remediation Recommendation**:
  1. In `creditNotes.create`, disallow `unitPriceUsd` from client input: authoritatively set `unitPriceUsd = billed.unitPrice`.
  2. Reject any client-supplied `taxUsd`: calculate tax deterministically using `computeSeniatBreakdown`.
  3. Fetch `exchangeRateBcv` authoritatively from the latest active rate in `ExchangeRate` table.

---

#### SEC-API-004: Client-Controlled Exchange Rate and Unlinked Line Items in Fiscal Documents

- **Severity**: **HIGH** (CVSS 8.2 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:L)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-472 (Reliance on Untrusted Inputs), CWE-20
- **Affected Component**:
  - `packages/api/src/modules/fiscal.ts`: Lines 170–274 (`fiscal.emitDocument`)
- **Vulnerability Details & Mechanism**:
  `fiscal.emitDocument` accepts:
  - `exchangeRateBcv: z.number().positive()`
  - `lines: z.array(z.object({ subtotalUsd: z.number().min(0), taxClassification: ... }))`
    Even when `orderId` or `internalInvoiceId` is provided, the procedure **never checks** if the supplied line amounts, quantities, or totals match the underlying order. Furthermore, `exchangeRateBcv` is trusted verbatim from the client.
- **Exploitation Scenario**:
  An operator or attacker emits a SENIAT legal invoice linked to Order #123 (total $1,000 USD), but submits `lines: [{ subtotalUsd: 1.00 }]` and an artificially depressed `exchangeRateBcv: 1.00`. The official SENIAT sales book (`Libro de Ventas`) records 1 VES of tax base instead of the real transaction value, exposing the company to massive SENIAT tax evasion penalties and fraud.
- **Technical Remediation Recommendation**:
  1. When `orderId` or `internalInvoiceId` is passed, populate `lines` and amounts directly from `OrderItem` rows.
  2. Disallow manual `exchangeRateBcv` override unless caller possesses `rates.update` permission; default to the active system rate from `ExchangeRate`.

---

#### SEC-API-005: IEEE-754 Floating-Point Drift in Financial Math and DB Schema Columns

- **Severity**: **MEDIUM** (CVSS 5.3 / CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-682 (Incorrect Calculation)
- **Affected Component**:
  - `packages/api/src/modules/sales.ts`: Lines 1106–1114, Lines 1364–1378
  - `packages/db/src/schema.ts`: Lines 2017–2020 (`OrderItem`), Lines 2045 (`Payment`), Lines 2185–2187 (`Quote`)
- **Vulnerability Details & Mechanism**:
  While `@cendaro/validators/money.ts` contains helper functions (`roundMoney2`, `addMoney`, `multiplyMoney`), critical checkout pipelines in `sales.ts` perform raw JavaScript floating-point arithmetic:
  ```typescript
  // packages/api/src/modules/sales.ts:1364-1378
  const subtotal = input.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const discount = input.items.reduce(
    (sum, i) => sum + i.discount * i.quantity,
    0,
  );
  const total = subtotal - discount;
  ```
  Furthermore, the database columns in `packages/db/src/schema.ts` use `t.doublePrecision()` instead of fixed-point `numeric(12, 2)`.
- **Exploitation Scenario**:
  Accumulation of floating point drift (e.g. `19.99 * 3 = 59.970000000000006`) creates 1-cent discrepancies during payment validation (`received < total - MONEY_EPSILON`) or daily cash reconciliation. Over thousands of transactions, penny-shaving discrepancies accumulate in ledger accounts.
- **Technical Remediation Recommendation**:
  1. Refactor all arithmetic in `sales.ts`, `quotes.ts`, and `payments.ts` to use `multiplyMoney(item.unitPrice, item.quantity)` and `addMoney(...)`.
  2. Plan a migration for financial tables (`sales_order`, `order_item`, `payment`, `account_receivable`) to use PostgreSQL `numeric(12, 2)`.

---

### 2. Focus Area: tRPC Procedure Authorization & BOLA/IDOR

#### SEC-API-006: Credit Note Direct Approval Bypass Without Executive Workflow Verification

- **Severity**: **HIGH** (CVSS 8.5 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:L)
- **OWASP Classification**: A01:2021 – Broken Access Control
- **CWE Classification**: CWE-862 (Missing Authorization Check)
- **Affected Component**:
  - `packages/api/src/modules/credit-notes.ts`: Lines 344–400 (`creditNotes.approve`)
  - `packages/api/src/modules/approvals.ts`: Lines 311–316 (`dispatchApprovalSideEffects`)
- **Vulnerability Details & Mechanism**:
  When a credit note is created, `creditNotes.create` inserts an `Approval` entity (`edit_post_issue_document`).
  However:
  1. In `approvals.ts`, approving `edit_post_issue_document` **only dismisses system alerts**:
     ```typescript
     // packages/api/src/modules/approvals.ts:311-316
     case "channel_stock_move":
     case "edit_post_issue_document": {
       const now = new Date();
       await dismissApprovalAlerts(db, workspaceId, [approval.id], user, now);
       break;
     }
     ```
  2. In `creditNotes.approve`, the endpoint verifies that `ctx.workspace.role` is in `["owner", "admin", "supervisor"]`, but **never checks whether the associated `Approval` record was approved**!
     Any user holding `orders.approve` can directly execute `creditNotes.approve({ id })` on a newly created credit note, completely bypassing the approval queue and peer verification.
- **Exploitation Scenario**:
  A supervisor colludes with a buyer: the supervisor creates a fraudulent credit note and immediately calls `creditNotes.approve`, bypassing owner/admin review and restoring stock or zeroing out the buyer's AR balance.
- **Technical Remediation Recommendation**:
  In `creditNotes.approve`, query the associated `Approval` record:
  ```typescript
  const [approval] = await ctx.db
    .select()
    .from(Approval)
    .where(
      and(
        eq(Approval.entityType, "credit_note"),
        eq(Approval.entityId, note.id),
      ),
    )
    .limit(1);
  if (!approval || approval.status !== "approved") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "La nota de crédito requiere aprobación ejecutiva previa",
    });
  }
  ```

---

#### SEC-API-007: Frontline Employee Accounts Receivable Balance Erasure via Unchecked Retentions

- **Severity**: **HIGH** (CVSS 8.1 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)
- **OWASP Classification**: A01:2021 – Broken Access Control
- **CWE Classification**: CWE-863 (Incorrect Authorization), CWE-285 (Improper Authorization)
- **Affected Component**:
  - `packages/api/src/modules/fiscal.ts`: Lines 277–372 (`fiscal.recordRetention`)
  - `packages/validators/src/authz.ts`: Line 144 (`ROLE_PERMISSIONS.payments.create = SALES_FLOOR`)
- **Vulnerability Details & Mechanism**:
  `fiscal.recordRetention` is gated by `wsPermissionProcedure("payments", "create")`.
  According to `ROLE_PERMISSIONS`, `payments.create` is granted to `SALES_FLOOR` (`owner`, `admin`, `supervisor`, `employee`).
  An employee can submit:
  ```typescript
  {
    fiscalDocumentId: "...",
    ivaRetentionPct: 100,
    islrRetentionPct: 34,
    ivaRetentionVoucher: "COMP-001"
  }
  ```
  The procedure immediately calculates:
  ```typescript
  // packages/api/src/modules/fiscal.ts:354-369
  const newBalance = Math.max(0, roundMoney2(Number(ar.balance) - retentions.totalRetainedUsd));
  await ctx.db.update(AccountReceivable).set({ balance: newBalance, status: ... });
  ```
  There is no manager approval, no voucher verification against SENIAT portal, and no requirement for supervisor role.
- **Exploitation Scenario**:
  An employee erases up to 100% of IVA and 34% of the taxable base of an order from a friend's customer account by registering fake retention voucher numbers, reducing Accounts Receivable without supervisor authorization.
- **Technical Remediation Recommendation**:
  1. Change procedure builder on `fiscal.recordRetention` to `wsPermissionProcedure("payments", "approve")` or `wsPermissionProcedure("receivables", "update")` (restricting to `MANAGEMENT`: owner, admin, supervisor).
  2. Implement a retention voucher approval workflow requiring supervisor validation of the physical SENIAT voucher before updating `AccountReceivable.balance`.

---

#### SEC-API-008: Vendor Row Scoping Bypass via Omission of Customer ID

- **Severity**: **MEDIUM** (CVSS 6.5 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L)
- **OWASP Classification**: A01:2021 – Broken Access Control
- **CWE Classification**: CWE-639 (Authorization Bypass Through User-Controlled Key)
- **Affected Component**:
  - `packages/api/src/modules/vendor-scope.ts`: Lines 32–57 (`assertVendorCustomer`)
  - `packages/api/src/modules/sales.ts`: Line 1047
  - `packages/api/src/modules/quotes.ts`: Line 166
- **Vulnerability Details & Mechanism**:
  `assertVendorCustomer` is designed to prevent vendors from accessing or selling to customers outside their assigned portfolio:
  ```typescript
  // packages/api/src/modules/vendor-scope.ts:36-37
  export async function assertVendorCustomer(...): Promise<void> {
    const vendorId = vendorScopeId(ctx);
    if (!vendorId || !customerId) return;
  ```
  If `customerId` is omitted (`null` or `undefined`), the function immediately returns without error.
  In `sales.createOrder` and `quotes.create`, `customerId` is optional:
  `customerId: z.string().uuid().optional()`
- **Exploitation Scenario**:
  A vendor bypasses portfolio assignment constraints by placing orders with `customerId: undefined` (walk-in/unassigned), creating orders directly in channels or taking sales that should belong to other sales reps or corporate accounts.
- **Technical Remediation Recommendation**:
  In `assertVendorCustomer`:
  ```typescript
  if (vendorId && !customerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Los vendedores deben asociar sus pedidos a un cliente asignado a su cartera",
    });
  }
  ```

---

### 3. Focus Area: Race Conditions & Concurrency

#### SEC-API-009: Inventory Overselling and Silent Clamping Without Concurrency Row Locks

- **Severity**: **HIGH** (CVSS 7.9 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:L)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-362 (Concurrent Execution with Improper Synchronization), CWE-840
- **Affected Component**:
  - `packages/api/src/modules/sales.ts`: Lines 261–317 (`applyStockLifecycle`)
  - `packages/api/src/modules/sales.ts`: Lines 1227–1290 (`updateOrderStatus`)
  - `packages/api/src/modules/sales.ts`: Lines 1300–1405 (`checkoutPos`)
- **Vulnerability Details & Mechanism**:
  When closing an order or checking out at POS, `applyStockLifecycle` executes an atomic SQL update on `ChannelAllocation` and `StockLedger`:
  ```typescript
  // packages/api/src/modules/sales.ts:267-273
  return sql`GREATEST(${col} + ${entries[0][1]}, 0)`;
  ```
  Notice:
  1. It **never locks** the rows with `SELECT ... FOR UPDATE` before applying the deduction.
  2. It **never verifies** whether `currentStock >= requestedQuantity`.
  3. If stock is 1, and two orders for 1 unit are submitted concurrently, both run `GREATEST(stock - 1, 0)`. Both update queries set quantity to 0, both checkouts succeed, and both customers receive paid confirmations.
- **Exploitation Scenario**:
  A flash sale or high-traffic inventory run occurs for a limited-stock product (1 unit remaining). Multiple POS terminals or ecommerce webhook calls submit checkouts concurrently. All requests succeed, selling 10 physical units when only 1 exists in the warehouse, causing severe fulfillment failure and inventory stockouts.
- **Technical Remediation Recommendation**:
  1. In `applyStockLifecycle`, acquire an exclusive lock:
     `SELECT quantity FROM stock_ledger WHERE ... FOR UPDATE;`
  2. Validate that `stockLedger.quantity >= item.quantity`. If insufficient, throw `TRPCError({ code: "CONFLICT", message: "Stock insuficiente" })`.
  3. Change the update statement from `GREATEST(qty - delta, 0)` to `quantity = quantity - delta WHERE quantity >= delta`.

---

#### SEC-API-010: Duplicate Payment Submission & Order Over-Crediting Race Condition

- **Severity**: **HIGH** (CVSS 7.5 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-362 (Race Condition), CWE-20
- **Affected Component**:
  - `packages/api/src/modules/payments.ts`: Lines 113–181 (`executeAddPayment`)
  - `packages/db/src/schema.ts`: Lines 2031–2068 (`Payment` table schema)
- **Vulnerability Details & Mechanism**:
  `executeAddPayment` lacks concurrency controls:
  1. Unlike `checkoutPos`, it **has no idempotency key** (`idempotencyKey`).
  2. It executes an atomic addition:
     ```typescript
     // packages/api/src/modules/payments.ts:159
     totalPaid: sql`COALESCE(${SalesOrder.totalPaid}, 0) + ${input.amount}`,
     ```
  3. In `packages/db/src/schema.ts`, the `Payment` table has **no unique constraint** on `(workspaceId, reference)` or `(workspaceId, bankName, reference)`.
  4. If a client double-clicks or two API requests fire in parallel, both insert a payment and both increment `totalPaid`.
  5. There is no upper bound check ensuring `totalPaid <= order.total`.
- **Exploitation Scenario**:
  A cashier or automated payment webhook submits two parallel payment requests of $500 for a $500 order. Both succeed, `totalPaid` becomes $1,000, creating an unaccounted $500 overpayment anomaly in the financial ledger. Furthermore, a single bank transfer reference can be reused across multiple orders.
- **Technical Remediation Recommendation**:
  1. Add `idempotencyKey: z.string().uuid().optional()` to `addPaymentInputSchema`.
  2. Enforce transaction advisory lock:
     `SELECT pg_advisory_xact_lock(hashtextextended('payment_add:' || workspaceId || ':' || orderId, 0));`
  3. Check that `COALESCE(order.totalPaid, 0) + input.amount <= order.total + 0.01`.
  4. Add a unique index in PostgreSQL on `(workspace_id, reference)` where `reference IS NOT NULL AND reference != ''`.

---

#### SEC-API-011: Inventory Multi-Injection and Replay Attack in Container Receipt

- **Severity**: **HIGH** (CVSS 7.5 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-362, CWE-840
- **Affected Component**:
  - `packages/api/src/modules/containers.ts`: Lines 140–300 (`containerRouter.receiveItems`)
- **Vulnerability Details & Mechanism**:
  `containerRouter.receiveItems` updates `StockLedger` and `ChannelAllocation`:
  ```typescript
  // packages/api/src/modules/containers.ts:285
  quantity: sql`${StockLedger.quantity} + ${item.quantityReceived}`,
  // packages/api/src/modules/containers.ts:301
  quantity: sql`${ChannelAllocation.quantity} + ${item.quantityReceived}`,
  ```
  The endpoint **never checks `container.status`**! It does not check if the container is already `received` or `closed`. It does not mark received container items with an immutable received flag.
- **Exploitation Scenario**:
  An operator or attacker submits `receiveItems` multiple times for the same container. Each request repeatedly adds hundreds of inventory units to the warehouse and showroom channels and recalculates weighted average costs, creating massive phantom stock in the ERP.
- **Technical Remediation Recommendation**:
  1. Enforce container status precondition:
     ```typescript
     if (container.status === "received" || container.status === "closed") {
       throw new TRPCError({
         code: "CONFLICT",
         message:
           "La mercancía de este contenedor ya fue ingresada al inventario",
       });
     }
     ```
  2. Mark container items as `isReceived: true` and transition container status to `received` atomically in the same transaction.

---

#### SEC-API-012: Uncontrolled Purchase Receipt Repetition & Weighted Cost Distortion

- **Severity**: **MEDIUM** (CVSS 6.5 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-20, CWE-840
- **Affected Component**:
  - `packages/api/src/modules/inventory.ts`: Lines 1166–1280 (`inventory.receivePurchase`)
- **Vulnerability Details & Mechanism**:
  `receivePurchase` records national purchases and increments inventory. It accepts `invoiceNumber: z.string().min(1).max(128)`, but **never checks whether `(workspaceId, supplierId, invoiceNumber)` was previously received**.
- **Exploitation Scenario**:
  A supplier invoice is submitted twice by mistake or malice. The physical inventory and stock ledger are credited twice, distorting inventory valuation and financial audit books.
- **Technical Remediation Recommendation**:
  Add an audit lookup or unique constraint on `(workspaceId, supplierId, invoiceNumber)` ensuring that each supplier invoice can only be received once.

---

### 4. Focus Area: Mass Assignment & State Overrides

#### SEC-API-013: Unrestricted Order State Transitions to "Delivered" Without Payment Verification

- **Severity**: **HIGH** (CVSS 8.5 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:L)
- **OWASP Classification**: A01:2021 – Broken Access Control
- **CWE Classification**: CWE-840 (Business Logic Error), CWE-285 (Improper Authorization)
- **Affected Component**:
  - `packages/api/src/modules/sales.ts`: Lines 1227–1290 (`updateOrderStatus`)
- **Vulnerability Details & Mechanism**:
  `updateOrderStatus` accepts any valid enum value of `orderStatusEnum` (`draft`, `confirmed`, `paid`, `processing`, `delivered`, `invoiced`, `cancelled`, `returned`).
  The procedure lacks a **Finite State Machine (FSM)**. An order in `draft` or `confirmed` with $0 total paid and no approved credit can be updated straight to `delivered`:
  ```typescript
  // packages/api/src/modules/sales.ts:1258-1273
  const [updated] = await ctx.db.update(SalesOrder).set({ status: input.status })...
  const { isClosing } = await applyStockLifecycle(ctx, currentOrder, input.status);
  ```
  Setting status to `delivered` automatically executes `applyStockLifecycle`, deducting stock and logging the items as fulfilled.
- **Exploitation Scenario**:
  A rogue employee with `orders.update` creates a wholesale order of $50,000. Without submitting any payment, the employee changes the order status to `delivered`. The warehouse dispatches the merchandise, and the ERP records the order as successfully fulfilled.
- **Technical Remediation Recommendation**:
  Implement a strict transition matrix:
  ```typescript
  const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["delivered", "invoiced", "cancelled"],
    delivered: ["invoiced", "returned"],
    invoiced: ["returned"],
    cancelled: [],
    returned: [],
  };
  ```
  Before transitioning to `delivered` or `invoiced`, assert that `order.totalPaid >= order.total` OR that the customer's active credit limit covers the outstanding balance.

---

#### SEC-API-014: Missing `.strict()` Schema Enforcement on Financial Mutators

- **Severity**: **LOW** (Informational / Defensive Hardening)
- **OWASP Classification**: A08:2021 – Software and Data Integrity Failures
- **CWE Classification**: CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
- **Affected Component**:
  - `packages/validators/src/index.ts`
  - `packages/api/src/modules/sales.ts`
  - `packages/api/src/modules/catalog.ts`
- **Vulnerability Details & Mechanism**:
  Zod schemas throughout the API use loose `z.object({...})` without appending `.strict()`. While standard Zod stripping strips unmapped properties, mutators that perform dynamic updates (`const { id, ...updates } = input; await ctx.db.update(...).set(updates)`) can become vulnerable to parameter injection or mass assignment if passthrough options are added or shared schemas are reused.
- **Technical Remediation Recommendation**:
  Enforce `.strict()` on all mutation input schemas across financial, catalog, and administrative routers.

---

### 5. Focus Area: Accounting & Ledger Incoherence

#### SEC-API-015: Disconnect Between Payments Router and Accounts Receivable Balance

- **Severity**: **MEDIUM** (CVSS 6.5 / CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L)
- **OWASP Classification**: A04:2021 – Insecure Design
- **CWE Classification**: CWE-840 (Business Logic Error)
- **Affected Component**:
  - `packages/api/src/modules/payments.ts`: Lines 156–166 (`executeAddPayment`)
  - `packages/api/src/modules/receivables.ts`: Lines 39–152 (`executeRecordArPayment`)
  - `packages/api/src/modules/reporting.ts`: Lines 243–253 (`reconcileFinancialLedger`)
- **Vulnerability Details & Mechanism**:
  When a sales order with a customer is created in `sales.createOrder`, an `AccountReceivable` record is generated with `balance = order.total`.
  If a payment is later registered via `payments.add` (`executeAddPayment`), it increments `SalesOrder.totalPaid`, **but never decrements `AccountReceivable.balance` or `Customer.balance`**.
  Only `receivables.recordPayment` updates `AccountReceivable.balance`.
  Consequently, payments recorded via the payments router leave open accounts receivable intact, causing automated ledger reconciliation in `reporting.reconcileFinancialLedger` (`totalSales - (totalPayments + totalReceivables)`) to permanently fail and report negative discrepancies.
- **Exploitation Scenario**:
  A customer pays their invoice in full at the accounting desk via `payments.add`. The cashier confirms the payment. However, because `AccountReceivable` is never credited, the customer's account remains flagged as overdue and customer credit limits remain blocked.
- **Technical Remediation Recommendation**:
  In `packages/api/src/modules/payments.ts:156`, when adding payment to an order, look up any open `AccountReceivable` linked to that `orderId`. If present, decrement `AccountReceivable.balance` and `Customer.balance` and insert a `PaymentAllocation` row in the same transaction.

---

## Technical Remediation Plan

### Phase 1: Immediate Critical Fixes (Price & Financial Integrity)

1. **Catalog Price Enforcement**:
   - In `sales.ts`, update `createOrder` and `checkoutPos` to fetch prices from `ProductPrice`.
   - Disallow client-specified `unitPrice` except when overridden by an authorized role with supervisor approval.
2. **Quote Discount Validation**:
   - In `quotes.ts`, add validation ensuring `discount <= unitPrice` and `total > 0`.
   - Block conversion of negative-total quotes to sales orders.
3. **Credit Note Price Locking**:
   - In `credit-notes.ts`, lock `unitPriceUsd` to the original `OrderItem.unitPrice`.
   - Calculate taxes and exchange rates authoritatively using backend services.

### Phase 2: Authorization & Segregation of Duties

1. **Approval Enforcement**:
   - Enforce that `creditNotes.approve` requires a verified, approved `Approval` record.
2. **Retention Permissions**:
   - Elevate `fiscal.recordRetention` to `payments.approve` / `receivables.update`.
3. **Vendor Scoping**:
   - Require non-null, valid `customerId` for all vendor-created orders and quotes.

### Phase 3: Concurrency, Row Locks & Idempotency

1. **Inventory Deduction Locks**:
   - Add `SELECT ... FOR UPDATE` row locks in `applyStockLifecycle` and assert `quantity >= delta`.
2. **Payment Idempotency**:
   - Introduce `idempotencyKey` and advisory locks in `executeAddPayment`.
   - Enforce uniqueness on `(workspaceId, reference)` for payment records.
3. **Container Receipt Guards**:
   - Disallow re-receiving containers; verify container status before stock increment.

### Phase 4: State Machine & Ledger Consistency

1. **Order Status FSM**:
   - Enforce finite state machine transitions in `updateOrderStatus`. Require `totalPaid >= total` or valid approved credit before moving to `delivered`.
2. **Payment-AR Synchronization**:
   - Sync payments recorded in `payments.ts` with `AccountReceivable` and `Customer.balance`.
3. **Deterministic Math Migration**:
   - Replace raw JS floating point math in `sales.ts` with `@cendaro/validators/money` utilities.
