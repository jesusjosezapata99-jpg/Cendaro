/**
 * Inventory Module
 *
 * @see docs/architecture/module_api_blueprint_v1.md §3.3
 *
 * Screens: global stock, stock by warehouse, stock by channel, inventory ledger,
 *          counts, discrepancies & blocks, internal transfers
 * Endpoints: inventory.balances.list, inventory.ledger.list, inventory.transfer.create,
 *            inventory.counts.{create,submit}, inventory.discrepancies.{list,approve},
 *            inventory.channelAllocation.update
 */
export const MODULE_ID = "inventory" as const;
