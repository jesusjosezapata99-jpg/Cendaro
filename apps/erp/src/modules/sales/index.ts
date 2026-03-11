/**
 * Sales & Documents Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.6
 *
 * Screens: POS / store sale, orders, quotes, delivery notes, internal invoices
 * Endpoints: sales.orders.{create,update,confirm,issueInvoice,issueDeliveryNote,cancel},
 *            sales.quotes.create, sales.documents.renderPdf
 */
export const MODULE_ID = "sales" as const;
