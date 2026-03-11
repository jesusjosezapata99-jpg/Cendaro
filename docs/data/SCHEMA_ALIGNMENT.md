# Schema Alignment — Existing Drizzle vs New ERD Blueprint

> This document maps the existing `packages/db/src/schema.ts` (Drizzle ORM) tables to the target tables defined in the ERD & Schema Blueprint v1 and DBML Schema v1. It serves as a migration planning reference.

## Legend

- ✅ = Exists and is conceptually aligned
- ⚠️ = Exists but needs modifications (naming, fields, structure)
- ❌ = Missing — needs to be created
- 🗑️ = Exists in current schema but not in new ERD (evaluate for deprecation)

---

## Identity & RBAC

| New ERD Table      | Existing Table            | Status | Notes                                                                       |
| ------------------ | ------------------------- | ------ | --------------------------------------------------------------------------- |
| `users`            | `user_profile`            | ⚠️     | Rename consideration; current uses inline `role` enum instead of join table |
| `roles`            | — (inline `userRoleEnum`) | ❌     | New ERD uses a separate `roles` table                                       |
| `permissions`      | `permission`              | ✅     | Conceptually aligned                                                        |
| `role_permissions` | `role_permission`         | ✅     | Aligned                                                                     |
| `user_roles`       | —                         | ❌     | Current schema uses `role` column on `user_profile` instead of M:N join     |

## Catalog

| New ERD Table                  | Existing Table                        | Status | Notes                                                                                |
| ------------------------------ | ------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `brands`                       | `brand`                               | ✅     | Aligned                                                                              |
| `categories`                   | `category`                            | ✅     | Aligned (has `parentId` for tree)                                                    |
| `products`                     | `product`                             | ⚠️     | Naming: `sku` → `internal_code`, `barcode` needs NOT NULL, `is_blocked` field needed |
| `product_technical_attributes` | `product_attribute`                   | ⚠️     | Missing typed value columns (`value_text`, `value_number`), `sort_order`             |
| `product_uom_equivalences`     | —                                     | ❌     | UOM equivalences table doesn't exist                                                 |
| `product_suppliers`            | — (single `supplierId` FK on product) | ❌     | New ERD uses M:N supplier relationship                                               |

## Warehouses & Channels

| New ERD Table               | Existing Table                | Status | Notes                                                                  |
| --------------------------- | ----------------------------- | ------ | ---------------------------------------------------------------------- |
| `warehouses`                | `warehouse`                   | ⚠️     | Type enum values differ (`main` vs `warehouse`, `store` vs `showroom`) |
| `warehouse_locations`       | —                             | ❌     | Granular location tracking not implemented                             |
| `sales_channels`            | — (inline `salesChannelEnum`) | ❌     | New ERD uses a separate table with `consumes_from_channel_id`          |
| `channel_stock_allocations` | `channel_allocation`          | ⚠️     | Rename; add `warehouse_id` reference                                   |

## Inventory

| New ERD Table             | Existing Table    | Status | Notes                                                                                      |
| ------------------------- | ----------------- | ------ | ------------------------------------------------------------------------------------------ |
| `inventory_balances`      | `stock_ledger`    | ⚠️     | Different semantics: current is balance table, new has `on_hand`, `allocated`, `available` |
| `inventory_ledger`        | `stock_movement`  | ⚠️     | Rename; movement type enum values differ; add `approved_by`                                |
| `inventory_counts`        | `inventory_count` | ✅     | Conceptually aligned                                                                       |
| `inventory_count_items`   | —                 | ❌     | Per-item count detail table missing                                                        |
| `inventory_discrepancies` | —                 | ❌     | Discrepancy tracking table missing                                                         |

## Receiving & Containers

| New ERD Table          | Existing Table                   | Status | Notes                                                                                |
| ---------------------- | -------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `containers`           | `container`                      | ⚠️     | Existing has extra AI packing list fields; new separates into `packing_list_imports` |
| `container_documents`  | —                                | ❌     | Document attachment table missing                                                    |
| `packing_list_imports` | — (embedded in `container`)      | ❌     | Needs extraction to separate table                                                   |
| `packing_list_rows`    | — (embedded in `container_item`) | ❌     | Needs extraction                                                                     |
| `container_items`      | `container_item`                 | ⚠️     | Existing has AI fields; new adds cost breakdown columns                              |
| `container_receipts`   | —                                | ❌     | Receipt tracking table missing                                                       |

## Pricing & Exchange Rates

| New ERD Table          | Existing Table    | Status | Notes                                                                 |
| ---------------------- | ----------------- | ------ | --------------------------------------------------------------------- |
| `exchange_rates`       | `exchange_rate`   | ⚠️     | Fields map; `rate_type` enum differs slightly                         |
| `pricing_rules`        | —                 | ❌     | No pricing rules table exists                                         |
| `product_prices`       | `product_price`   | ⚠️     | New adds `active_from`/`active_to` temporal columns, `currency` field |
| `price_change_batches` | `repricing_event` | ⚠️     | Rename; field mapping needed                                          |
| `price_history`        | `price_history`   | ⚠️     | New adds `batch_id` FK                                                |

## Commercial / Sales

| New ERD Table            | Existing Table | Status | Notes                                                             |
| ------------------------ | -------------- | ------ | ----------------------------------------------------------------- |
| `customers`              | `customer`     | ⚠️     | Field name differences; type enum values differ                   |
| `customer_addresses`     | —              | ❌     | Separate address table missing                                    |
| `quotes`                 | —              | ❌     | Quotation table missing                                           |
| `quote_items`            | —              | ❌     | Missing                                                           |
| `orders`                 | `sales_order`  | ⚠️     | Rename; `status` enum values differ significantly                 |
| `order_items`            | `order_item`   | ⚠️     | Missing UOM fields (`uom`, `uom_quantity`, `base_units_quantity`) |
| `delivery_notes`         | —              | ❌     | Missing                                                           |
| `delivery_note_items`    | —              | ❌     | Missing                                                           |
| `internal_invoices`      | —              | ❌     | Missing                                                           |
| `internal_invoice_items` | —              | ❌     | Missing                                                           |

## Payments & Cash

| New ERD Table         | Existing Table                      | Status | Notes                                                |
| --------------------- | ----------------------------------- | ------ | ---------------------------------------------------- |
| `payments`            | `payment`                           | ⚠️     | Missing `invoice_id` FK; `method` enum values differ |
| `payment_allocations` | —                                   | ❌     | Missing                                              |
| `payment_evidence`    | — (single `evidenceUrl` on payment) | ❌     | Needs separate table for multiple evidences          |
| `accounts_receivable` | `account_receivable`                | ⚠️     | Missing `invoice_id` FK; status values differ        |
| `ar_installments`     | —                                   | ❌     | Missing                                              |
| `cash_closures`       | `cash_closure`                      | ⚠️     | Minor field differences                              |

## Integrations

| New ERD Table               | Existing Table    | Status | Notes                                        |
| --------------------------- | ----------------- | ------ | -------------------------------------------- |
| `mercadolibre_accounts`     | —                 | ❌     | Account table missing                        |
| `mercadolibre_listings`     | `ml_listing`      | ⚠️     | Missing `account_id` FK                      |
| `mercadolibre_orders`       | `ml_order`        | ⚠️     | Missing `sync_status`, `raw_payload_json`    |
| `mercadolibre_order_events` | —                 | ❌     | Missing                                      |
| `integration_failures`      | `integration_log` | ⚠️     | Different structure; new is failure-specific |

## Audit & Approvals

| New ERD Table   | Existing Table | Status | Notes                           |
| --------------- | -------------- | ------ | ------------------------------- |
| `approvals`     | —              | ❌     | Approval workflow table missing |
| `audit_logs`    | `audit_log`    | ✅     | Well aligned                    |
| `system_alerts` | `system_alert` | ✅     | Well aligned                    |
| `signatures`    | —              | ❌     | Missing                         |

## Tables in Current Schema Not in New ERD

| Current Table       | Status | Recommendation                                         |
| ------------------- | ------ | ------------------------------------------------------ |
| `organization`      | 🗑️     | Keep — useful for multi-org future; not contradicted   |
| `supplier`          | 🗑️     | Keep — will be superseded by `product_suppliers` M:N   |
| `ai_prompt_config`  | 🗑️     | Keep — implementation-specific, not part of domain ERD |
| `vendor_commission` | 🗑️     | Keep — not in ERD but useful for vendor portal         |

---

## Summary Statistics

- **Aligned (✅)**: 6 tables
- **Needs modification (⚠️)**: 19 tables
- **Missing (❌)**: 20 tables
- **Evaluate for deprecation (🗑️)**: 4 tables (recommended: keep all)

## Recommended Migration Order

Per ERD Blueprint §11:

1. Auth & permissions (normalize RBAC)
2. Catalog core (UOM equivalences, product_suppliers)
3. Warehouses & channels (separate tables)
4. Inventory balances & ledger (rename + add fields)
5. Receiving & containers (extract packing list tables)
6. Pricing & exchange rates (add pricing_rules)
7. Customers & credit (add addresses, installments)
8. Sales & documents (add quotes, delivery notes, invoices)
9. Payments & cash closure (add evidence, allocations)
10. Integrations (add ML accounts, events, failures)
11. Approvals & audit (add approvals, signatures)
