/**
 * Vendor Portal Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.9
 *
 * Screens: vendor dashboard, my customers, my orders, my collections
 * Endpoints: vendor.orders.{create,listMine}, vendor.customers.listMine,
 *            vendor.receivables.listMine, vendor.payments.registerInfo
 */
export const MODULE_ID = "vendors" as const;
