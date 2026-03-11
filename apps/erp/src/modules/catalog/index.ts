/**
 * Catalog Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.2
 *
 * Screens: product list, product detail/edit, brands, categories, tech attributes, UOM equivalences
 * Endpoints: catalog.products.{list,get,create,update,block}, catalog.categories.{tree,create},
 *            catalog.brands.list, catalog.attributes.upsert, catalog.equivalences.upsert
 */
export const MODULE_ID = "catalog" as const;
