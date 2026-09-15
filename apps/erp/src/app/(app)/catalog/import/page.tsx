import dynamic from "next/dynamic";

import { ListPageSkeleton } from "~/components/skeleton";

const CatalogImportWizard = dynamic(
  () =>
    import("~/modules/catalog-import/catalog-import-wizard").then(
      (m) => m.CatalogImportWizard,
    ),
  {
    loading: () => <ListPageSkeleton />,
  },
);

/**
 * Catalog Import — Server Component page wrapper
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
export default function CatalogImportPage() {
  return <CatalogImportWizard />;
}
