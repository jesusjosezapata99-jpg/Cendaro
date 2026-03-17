/**
 * Inventory Import Page
 *
 * Server Component — renders the InventoryImportWizard.
 * Route: /inventory/warehouse/[id]/import
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15
 */

import { InventoryImportWizard } from "~/modules/receiving/inventory-import/inventory-import-wizard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InventoryImportPage({ params }: PageProps) {
  const { id } = await params;

  return <InventoryImportWizard warehouseId={id} />;
}
