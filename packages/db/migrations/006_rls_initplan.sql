-- Cendaro ERP — Evaluate the RLS workspace setting once per query (initplan)
-- PLAN-2026-09-PROD-HARDENING, phase F6 (finding H7)
--
-- 64 app_user policies compared a column with a bare
--   (current_setting('app.workspace_id'::text, true))::uuid
-- which Postgres re-evaluates for every row it scans (advisor lint 0003
-- auth_rls_initplan). Wrapping current_setting() in a scalar subquery makes it
-- an InitPlan evaluated once per statement. Same predicate, same result.
--
-- The cast goes OUTSIDE the subquery: (SELECT current_setting('app.workspace_id', true))::uuid.
-- With the cast inside, Postgres stores "SELECT (current_setting(...))::uuid",
-- which is also an InitPlan but is still reported by lint 0003 (this is why
-- workspace_app_user_update from 004 is included).
--
-- History: fix_rls_initplan_performance (2026-03-07) wrapped auth.uid() in the
-- earlier per-user policies. The workspace policies that replaced them
-- (fix_workspace_rls_policies 2026-03-23, then 002) were always created from
-- the unwrapped workspacePolicy() factory. The factory in
-- packages/db/src/schema.ts now emits the target form, so drizzle and the
-- database agree.
--
-- ALTER POLICY keeps name, role, command and the PERMISSIVE flag; only the
-- expressions change. Generated 2026-09-15 from pg_policies (read-only session)
-- and reviewed. Clauses converted: 124 × workspace_id = BARE; 2 × id = CAST_INSIDE.
--
-- Rollback: 006_rls_initplan.rollback.sql

BEGIN;

ALTER POLICY account_receivable_workspace_isolation ON public.account_receivable
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY ai_prompt_config_workspace_isolation ON public.ai_prompt_config
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY approval_workspace_isolation ON public.approval
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY ar_installment_workspace_isolation ON public.ar_installment
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY audit_log_workspace_insert ON public.audit_log
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY audit_log_workspace_select ON public.audit_log
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY brand_workspace_isolation ON public.brand
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY cash_closure_workspace_isolation ON public.cash_closure
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY category_workspace_isolation ON public.category
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY category_alias_workspace_isolation ON public.category_alias
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY channel_allocation_workspace_isolation ON public.channel_allocation
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY container_workspace_isolation ON public.container
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY container_document_workspace_isolation ON public.container_document
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY container_item_workspace_isolation ON public.container_item
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY customer_workspace_isolation ON public.customer
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY customer_address_workspace_isolation ON public.customer_address
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY delivery_note_workspace_isolation ON public.delivery_note
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY delivery_note_item_workspace_isolation ON public.delivery_note_item
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY document_sequence_workspace_isolation ON public.document_sequence
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY exchange_rate_workspace_isolation ON public.exchange_rate
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY import_session_workspace_isolation ON public.import_session
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY import_session_row_workspace_isolation ON public.import_session_row
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY integration_failure_workspace_isolation ON public.integration_failure
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY integration_log_workspace_isolation ON public.integration_log
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY internal_invoice_workspace_isolation ON public.internal_invoice
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY internal_invoice_item_workspace_isolation ON public.internal_invoice_item
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY inventory_count_workspace_isolation ON public.inventory_count
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY inventory_count_item_workspace_isolation ON public.inventory_count_item
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY inventory_discrepancy_workspace_isolation ON public.inventory_discrepancy
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY mercadolibre_account_workspace_isolation ON public.mercadolibre_account
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY mercadolibre_order_event_workspace_isolation ON public.mercadolibre_order_event
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY ml_listing_workspace_isolation ON public.ml_listing
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY ml_order_workspace_isolation ON public.ml_order
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY notification_bucket_workspace_isolation ON public.notification_bucket
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY notification_bucket_assignee_workspace_isolation ON public.notification_bucket_assignee
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY notification_routing_rule_workspace_isolation ON public.notification_routing_rule
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY order_item_workspace_isolation ON public.order_item
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY payment_workspace_isolation ON public.payment
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY payment_allocation_workspace_isolation ON public.payment_allocation
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY payment_evidence_workspace_isolation ON public.payment_evidence
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY price_history_workspace_isolation ON public.price_history
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY pricing_rule_workspace_isolation ON public.pricing_rule
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY product_workspace_isolation ON public.product
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY product_attribute_workspace_isolation ON public.product_attribute
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY product_price_workspace_isolation ON public.product_price
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY product_supplier_workspace_isolation ON public.product_supplier
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY product_uom_equivalence_workspace_isolation ON public.product_uom_equivalence
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY quote_workspace_isolation ON public.quote
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY quote_item_workspace_isolation ON public.quote_item
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY repricing_event_workspace_isolation ON public.repricing_event
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY sales_order_workspace_isolation ON public.sales_order
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY signature_workspace_isolation ON public.signature
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY stock_ledger_workspace_isolation ON public.stock_ledger
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY stock_movement_workspace_isolation ON public.stock_movement
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY supplier_workspace_isolation ON public.supplier
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY system_alert_workspace_isolation ON public.system_alert
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY vendor_commission_workspace_isolation ON public.vendor_commission
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY warehouse_workspace_isolation ON public.warehouse
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY warehouse_location_workspace_isolation ON public.warehouse_location
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY workspace_app_user_update ON public.workspace
  USING (id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY workspace_member_workspace_isolation ON public.workspace_member
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY workspace_module_workspace_isolation ON public.workspace_module
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY workspace_profile_workspace_isolation ON public.workspace_profile
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);
ALTER POLICY workspace_quota_workspace_isolation ON public.workspace_quota
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);

COMMIT;
