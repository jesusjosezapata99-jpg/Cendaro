/**
 * Audit & Approvals Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.11
 * @see docs/architecture/erd_schema_blueprint_v1.md §6 (approvals, audit_logs, signatures)
 *
 * Entities: approvals, audit_logs, system_alerts, signatures
 * Approval types: credit_sale, inventory_adjustment, channel_stock_move, product_unblock,
 *                 price_change, container_close, cash_closure, edit_post_issue_document
 */
export const MODULE_ID = "audit" as const;
