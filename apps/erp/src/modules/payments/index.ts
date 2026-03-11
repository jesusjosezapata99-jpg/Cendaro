/**
 * Payments & Cash Closure Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.7
 *
 * Screens: payment registration, evidence upload, daily cash closure
 * Endpoints: payments.{record,attachEvidence,listByOrder},
 *            cashClosure.{open,summary,close}
 */
export const MODULE_ID = "payments" as const;
