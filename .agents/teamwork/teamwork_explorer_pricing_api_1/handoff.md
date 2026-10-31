# Handoff Report: API Layer, Financial & Pricing Logic, and Transaction Integrity Audit

**Agent**: `teamwork_explorer_pricing_api_1`  
**Working Directory**: `c:\Users\jzs99\Desktop\TEST\.agents\teamwork\teamwork_explorer_pricing_api_1`  
**Date**: 2026-10-31T19:12:00Z  
**Type**: Hard Handoff (Investigation & Threat Modeling Complete)  
**Deliverable Artifact**: `analysis.md` (Detailed 15-finding vulnerability report)

---

## 1. Observation

Direct code observations from inspecting the codebase:

1. **Client-Controlled Unit Price in Orders and POS Checkout**:
   - `packages/api/src/modules/sales.ts:1037-1043`:
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
   - `packages/api/src/modules/sales.ts:1106-1114`:
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
   - `packages/api/src/modules/sales.ts:1364-1378`: In `checkoutPos`, subtotal and total are calculated identically using client-supplied `unitPrice`.

2. **Negative Total Quotes and Order Conversion**:
   - `packages/api/src/modules/quotes.ts:188-196`:
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
   - In `quotes.create`, there is no validation check ensuring `discount <= unitPrice`.
   - `packages/api/src/modules/quotes.ts:352-354`: In `quotes.convertToOrder`, `total: quote.total` is directly assigned to `SalesOrder.total` without checking `quote.total > 0`.

3. **Arbitrary Pricing in Credit Notes**:
   - `packages/api/src/modules/credit-notes.ts:247`:
     ```typescript
     const unitPriceUsd = roundMoney2(line.unitPriceUsd ?? billed.unitPrice);
     ```
   - While `line.quantity` is checked against `maxReturnable`, `line.unitPriceUsd` is taken directly from input and never checked against `billed.unitPrice`.

4. **Non-Locking Inventory Clamping & Race Conditions**:
   - `packages/api/src/modules/sales.ts:267-273` in `applyStockLifecycle`:
     ```typescript
     return sql`GREATEST(${col} + ${entries[0][1]}, 0)`;
     ```
   - No `SELECT ... FOR UPDATE` row locks are acquired. No check exists ensuring `StockLedger.quantity >= requestedQuantity`.

5. **Arbitrary Status Update to "Delivered"**:
   - `packages/api/src/modules/sales.ts:1227-1290`:
     `updateOrderStatus` updates `SalesOrder.status` without verifying that `totalPaid >= total` or that the customer has an approved credit limit. Setting status to `delivered` immediately invokes `applyStockLifecycle`, deducting stock.

6. **Payment Idempotency and Reference Uniqueness**:
   - `packages/api/src/modules/payments.ts:156-166`: `executeAddPayment` increments `SalesOrder.totalPaid` with no idempotency key and no check against `order.total`.
   - `packages/db/src/schema.ts:2031-2068`: `Payment` table has no unique constraint on `(workspaceId, reference)`.

7. **Retention Write-Off Authorization**:
   - `packages/api/src/modules/fiscal.ts:277-372`: Gated by `wsPermissionProcedure("payments", "create")` (which `employee` holds per `ROLE_PERMISSIONS.payments.create = SALES_FLOOR`). It directly reduces `AccountReceivable.balance` up to 100% of IVA and 34% of ISLR without manager approval.

---

## 2. Logic Chain

1. **Premise**: In financial and ERP systems, all monetary amounts, unit prices, discounts, and tax rates must be calculated authoritatively on the server from validated catalog price tiers and exchange rate engines.
2. **Observation Step 1**: In `sales.createOrder` and `sales.checkoutPos`, unit prices and discounts are accepted directly from client JSON input without verification against `ProductPrice`.
3. **Deduction Step 1**: An attacker or rogue cashier can submit `unitPrice: 0.01` or `unitPrice: 0.00` for high-value products, pay 1 cent, and receive an invoiced order that immediately deducts physical stock.
4. **Observation Step 2**: In `quotes.create`, the lack of a `discount <= unitPrice` check allows negative totals, and `quotes.convertToOrder` copies this negative total into `SalesOrder.total`.
5. **Deduction Step 2**: Negative-balance sales orders bypass credit limit checks (`total > 0`) and corrupt financial reconciliation ledgers.
6. **Observation Step 3**: In `creditNotes.create`, client-supplied `unitPriceUsd` is accepted without verifying `unitPriceUsd <= billed.unitPrice`, reducing `AccountReceivable.balance` upon approval by arbitrary sums.
7. **Observation Step 4**: In `applyStockLifecycle`, inventory is decremented with `GREATEST(stock - delta, 0)` without row-level `FOR UPDATE` locking and without checking available balance.
8. **Deduction Step 4**: Parallel checkouts or status changes cause inventory overselling, fulfilling sales when physical stock is 0.
9. **Observation Step 5**: `sales.updateOrderStatus` lacks finite state machine transitions, permitting transition to `delivered` for unpaid orders, while `fiscal.recordRetention` permits frontline staff to write off AR debts up to 100% IVA and 34% ISLR.
10. **Conclusion**: The API layer and financial pipelines possess critical vulnerabilities that permit price manipulation, unauthorized debt erasure, inventory overselling, and transaction integrity corruption.

---

## 3. Caveats

- **External Integrations**: Mercado Libre OAuth token exchange and WhatsApp webhook signature verification require external network credentials that were not dynamically tested in this read-only phase.
- **Client Side Validation**: Frontend React components (e.g. POS cart, order forms) may calculate correct catalog prices in the UI, but this does not protect the server-side tRPC API against direct programmatic manipulation.
- **No Source Code Changes**: Per instructions, no code in `apps/` or `packages/` was altered during this threat modeling and investigation turn.

---

## 4. Conclusion

The API layer and financial logic of Cendaro ERP currently fail zero-trust pricing and financial integrity standards in several core endpoints:

- Unit prices and line discounts in orders, POS, quotes, and credit notes are client-controlled rather than server-authoritative.
- Inventory lifecycle functions lack concurrency locks and pre-condition checks, allowing silent overselling.
- Financial state transitions permit moving unpaid orders to `delivered`, directly releasing merchandise.
- Critical debt write-offs via tax retentions are available to frontline staff without supervisor authorization.

The complete inventory of findings and step-by-step remediation plans are documented in `c:\Users\jzs99\Desktop\TEST\.agents\teamwork\teamwork_explorer_pricing_api_1\analysis.md`.

---

## 5. Verification Method

To independently verify the observations:

1. **Inspect Affected Files**:
   - `packages/api/src/modules/sales.ts` (Lines 1031–1115, 1227–1290, 1300–1405, 261–317)
   - `packages/api/src/modules/quotes.ts` (Lines 148–246, 286–403)
   - `packages/api/src/modules/credit-notes.ts` (Lines 110–265, 344–400)
   - `packages/api/src/modules/fiscal.ts` (Lines 170–274, 277–372)
   - `packages/api/src/modules/payments.ts` (Lines 113–181)
   - `packages/api/src/modules/containers.ts` (Lines 140–300)
   - `packages/api/src/modules/inventory.ts` (Lines 1166–1280)
   - `packages/api/src/modules/vendor-scope.ts` (Lines 32–57)

2. **Automated Verification**:
   - Run existing test suites: `pnpm test`
   - Specifically run authz coverage: `pnpm exec vitest run src/__tests__/procedure-authz-coverage.test.ts`
   - Invalidation conditions: If unit prices are verified against `ProductPrice` before saving `OrderItem`, or if `applyStockLifecycle` rejects checkouts when stock is insufficient, the corresponding findings are invalidated.
