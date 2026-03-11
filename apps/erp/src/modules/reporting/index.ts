/**
 * Reporting & Exports Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.11
 *
 * Screens: owner/admin dashboard, exportable reports, audit log, alerts
 * Endpoints: reports.sales.summary, reports.inventory.summary, reports.receivables.summary,
 *            reports.export.{excel,pdf}, audit.logs.list, alerts.{list,acknowledge}
 */
export const MODULE_ID = "reporting" as const;
