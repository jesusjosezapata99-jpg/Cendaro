import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import CatalogClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Catalog — Server Component with SSR Prefetch
 *
 * Prefetch lives below a Suspense boundary (required by `cacheComponents`
 * so the segment shell renders instantly — instant-unrendered-segment).
 */
export default function CatalogPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CatalogPrefetch />
    </Suspense>
  );
}

async function CatalogPrefetch() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchInfiniteQuery(
      trpc.catalog.listProducts.infiniteQueryOptions(
        { limit: 50 },
        {
          getNextPageParam: (lastPage) => {
            if (
              lastPage.items.length < 50 ||
              lastPage.items.length >= lastPage.total
            ) {
              return undefined;
            }
            return 50;
          },
        },
      ),
    );
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CatalogClient />
    </HydrationBoundary>
  );
}
