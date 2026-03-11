/**
 * Accounts Receivable Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.8
 *
 * Screens: accounts receivable list, overdue view, customer status
 * Endpoints: receivables.{list,byCustomer,createFromInvoice,markPaid,overrideBlock}
 */
export const MODULE_ID = "receivables" as const;
