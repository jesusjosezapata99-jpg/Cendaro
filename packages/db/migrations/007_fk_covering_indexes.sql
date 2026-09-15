-- Cendaro ERP — Covering indexes for foreign keys
-- PLAN-2026-09-PROD-HARDENING, phase F7 (finding H8)
--
-- Postgres does not index foreign keys. 61 FKs had no index whose
-- leading column is the FK column (advisor lint 0001 unindexed_foreign_keys):
-- 35 on workspace_id (the RLS predicate of every workspace policy) and
-- 26 others (4 of them used by API joins/filters:
-- role_permission.permission_id, category_alias.category_id,
-- sales_order.created_by, account_receivable.order_id).
--
-- Every name was checked before generation: none exists, max length 45.
-- Plain CREATE INDEX (not CONCURRENTLY): the largest table has ~2.4k rows, so
-- each build holds its SHARE lock for milliseconds, and CONCURRENTLY cannot
-- run inside the migration transaction. Mirrored in packages/db/src/schema.ts
-- so drizzle-kit keeps them; guarded by fk-index-coverage.test.ts.
--
-- Rollback: 007_fk_covering_indexes.rollback.sql

BEGIN;

CREATE INDEX IF NOT EXISTS idx_account_receivable_order_id ON public.account_receivable USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_account_receivable_workspace_id ON public.account_receivable USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_approval_workspace_id ON public.approval USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ar_installment_workspace_id ON public.ar_installment USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_id ON public.audit_log USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_cash_closure_workspace_id ON public.cash_closure USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_category_alias_category_id ON public.category_alias USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_container_document_uploaded_by ON public.container_document USING btree (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_container_document_workspace_id ON public.container_document USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_container_item_suggested_product_id ON public.container_item USING btree (suggested_product_id);
CREATE INDEX IF NOT EXISTS idx_container_item_workspace_id ON public.container_item USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_customer_workspace_id ON public.customer USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_customer_address_workspace_id ON public.customer_address USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_created_by ON public.delivery_note USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_note_item_workspace_id ON public.delivery_note_item USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_workspace_id ON public.exchange_rate USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_import_session_row_resolved_brand_id ON public.import_session_row USING btree (resolved_brand_id);
CREATE INDEX IF NOT EXISTS idx_import_session_row_resolved_category_id ON public.import_session_row USING btree (resolved_category_id);
CREATE INDEX IF NOT EXISTS idx_import_session_row_resolved_product_id ON public.import_session_row USING btree (resolved_product_id);
CREATE INDEX IF NOT EXISTS idx_import_session_row_workspace_id ON public.import_session_row USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_failure_resolved_by ON public.integration_failure USING btree (resolved_by);
CREATE INDEX IF NOT EXISTS idx_integration_failure_workspace_id ON public.integration_failure USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_log_workspace_id ON public.integration_log USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_internal_invoice_created_by ON public.internal_invoice USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_internal_invoice_item_workspace_id ON public.internal_invoice_item USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_workspace_id ON public.inventory_count USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_item_workspace_id ON public.inventory_count_item USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_inventory_discrepancy_resolved_by ON public.inventory_discrepancy USING btree (resolved_by);
CREATE INDEX IF NOT EXISTS idx_inventory_discrepancy_workspace_id ON public.inventory_discrepancy USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_mercadolibre_order_event_workspace_id ON public.mercadolibre_order_event USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ml_order_sales_order_id ON public.ml_order USING btree (sales_order_id);
CREATE INDEX IF NOT EXISTS idx_notification_bucket_assignee_member_id ON public.notification_bucket_assignee USING btree (member_id);
CREATE INDEX IF NOT EXISTS idx_notification_bucket_assignee_workspace_id ON public.notification_bucket_assignee USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_notification_routing_rule_bucket_id ON public.notification_routing_rule USING btree (bucket_id);
CREATE INDEX IF NOT EXISTS idx_order_item_workspace_id ON public.order_item USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payment_workspace_id ON public.payment USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocation_workspace_id ON public.payment_allocation USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payment_evidence_uploaded_by ON public.payment_evidence USING btree (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_payment_evidence_workspace_id ON public.payment_evidence USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_price_history_workspace_id ON public.price_history USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rule_created_by ON public.pricing_rule USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_pricing_rule_workspace_id ON public.pricing_rule USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_product_uom_equivalence_workspace_id ON public.product_uom_equivalence USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_quote_converted_order_id ON public.quote USING btree (converted_order_id);
CREATE INDEX IF NOT EXISTS idx_quote_created_by ON public.quote USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_quote_item_workspace_id ON public.quote_item USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_repricing_event_workspace_id ON public.repricing_event USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_role_permission_permission_id ON public.role_permission USING btree (permission_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_closed_by ON public.sales_order USING btree (closed_by);
CREATE INDEX IF NOT EXISTS idx_sales_order_created_by ON public.sales_order USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_signature_workspace_id ON public.signature USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_warehouse_id ON public.stock_movement USING btree (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_workspace_id ON public.stock_movement USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_supplier_workspace_id ON public.supplier USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_alert_workspace_id ON public.system_alert USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_organization_id ON public.user_profile USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_commission_workspace_id ON public.vendor_commission USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_workspace_id ON public.warehouse USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_created_by ON public.workspace USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_workspace_member_invited_by ON public.workspace_member USING btree (invited_by);
CREATE INDEX IF NOT EXISTS idx_workspace_module_enabled_by ON public.workspace_module USING btree (enabled_by);

COMMIT;
