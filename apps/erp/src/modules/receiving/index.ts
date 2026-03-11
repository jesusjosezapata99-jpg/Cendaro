/**
 * Receiving & Containers Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.4
 *
 * Screens: container list, container detail, packing list upload, import review, final reception
 * Endpoints: receiving.containers.{list,create}, receiving.packingList.{upload,parse},
 *            receiving.containerItems.matchProducts, receiving.container.{close,approve}
 */
export const MODULE_ID = "receiving" as const;
