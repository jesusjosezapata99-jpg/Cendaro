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
 * Opt out of Next's dev-only instant-navigation validation: this segment is
 * auth-gated (Supabase session + DB in the (app) layout), so the synthetic
 * validation pass can never render it and reports E1286
 * (instant-unrendered-segment). The dynamic() loading skeleton already
 * provides the instant shell.
 */
export const instant = false;

/**
 * Catalog Import — Server Component page wrapper
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
export default function CatalogImportPage() {
  return <CatalogImportWizard />;
}
