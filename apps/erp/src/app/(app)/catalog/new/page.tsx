import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { DetailSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import CreateProductPage from "./create-product-page";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * New Product — Server Component with SSR Prefetch
 * Warms the 4 reference queries the create form uses (brands, categories,
 * suppliers, latest rates) with the same queryKeys its hooks generate.
 */
export default function NewProductPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <NewProductPrefetch />
    </Suspense>
  );
}

async function NewProductPrefetch() {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(trpc.catalog.listBrands.queryOptions()),
      queryClient.prefetchQuery(trpc.catalog.listCategories.queryOptions()),
      queryClient.prefetchQuery(trpc.catalog.listSuppliers.queryOptions()),
      queryClient.prefetchQuery(trpc.pricing.latestRates.queryOptions()),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CreateProductPage />
    </HydrationBoundary>
  );
}
