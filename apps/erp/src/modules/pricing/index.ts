/**
 * Pricing & Exchange Rates Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.5
 *
 * Screens: rate panel, batch repricing, price history, margin view
 * Endpoints: pricing.rates.{list,upsert}, pricing.batch.{generate,preview,approve},
 *            pricing.history.list, pricing.margins.summary
 */
export const MODULE_ID = "pricing" as const;
