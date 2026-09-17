import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import CustomersClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Customers — Server Component with SSR Prefetch
 *
 * Prefetch lives below a Suspense boundary (required by `cacheComponents`
 * so the segment shell renders instantly — instant-unrendered-segment).
 */
export default function CustomersPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CustomersPrefetch />
    </Suspense>
  );
}

async function CustomersPrefetch() {
  const queryClient = getQueryClient();

  try {
    // Must match the first page requested by CustomersClient (page size 50).
    await Promise.all([
      queryClient.prefetchInfiniteQuery(
        trpc.sales.listCustomers.infiniteQueryOptions(
          { limit: 50 },
          {
            getNextPageParam: (lastPage, allPages) =>
              lastPage.length < 50 ? undefined : allPages.length * 50,
          },
        ),
      ),
      queryClient.prefetchQuery(trpc.sales.customerStats.queryOptions()),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomersClient />
    </HydrationBoundary>
  );
}
