/**
 * Inventory Import Page
 *
 * Server Component — renders the InventoryImportWizard.
 * Route: /inventory/warehouse/[id]/import
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15
 */

import dynamic from "next/dynamic";

import { ListPageSkeleton } from "~/components/skeleton";

const InventoryImportWizard = dynamic(
  () =>
    import("~/modules/receiving/inventory-import/inventory-import-wizard").then(
      (m) => m.InventoryImportWizard,
    ),
  {
    loading: () => <ListPageSkeleton />,
  },
);

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment is
 * auth-gated (Supabase session + DB in the (app) layout), so the synthetic
 * validation pass can never render it and reports E1286
 * (instant-unrendered-segment). The dynamic() loading skeleton already
 * provides the instant shell.
 */
export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InventoryImportPage({ params }: PageProps) {
  const { id } = await params;

  return <InventoryImportWizard warehouseId={id} />;
}
