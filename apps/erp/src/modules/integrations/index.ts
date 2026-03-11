/**
 * Integrations Module (Mercado Libre + External)
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.10
 *
 * Screens: ML integration panel, ML orders, sync errors, shipping status
 * Endpoints: integrations.ml.accounts.get, integrations.ml.orders.{import,list,syncStatus},
 *            integrations.ml.stock.push, integrations.failures.list
 */
export const MODULE_ID = "integrations" as const;
