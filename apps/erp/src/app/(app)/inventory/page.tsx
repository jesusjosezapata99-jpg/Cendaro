import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import AppLoading from "../loading";
import InventoryClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Inventory — Server Component with SSR Prefetch
 *
 * Prefetches stock overview, channel summary, and warehouses in parallel
 * so TanStack Query's cache is pre-warmed before the client hydrates.
 *
 * Prefetch lives below a Suspense boundary (required by `cacheComponents`
 * so the segment shell renders instantly — instant-unrendered-segment).
 */
export default function InventoryPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <InventoryPrefetch />
    </Suspense>
  );
}

async function InventoryPrefetch() {
  const queryClient = getQueryClient();

  try {
    // Shared queryOptions — same queryKey as the client hooks (options proxy)
    await Promise.all([
      queryClient.prefetchQuery(trpc.inventory.stockOverview.queryOptions({})),
      queryClient.prefetchQuery(trpc.inventory.channelSummary.queryOptions()),
      queryClient.prefetchQuery(trpc.inventory.listWarehouses.queryOptions()),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InventoryClient />
    </HydrationBoundary>
  );
}
