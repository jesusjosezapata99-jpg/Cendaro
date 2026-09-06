import type { Metadata } from "next";
import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import PosClient from "./client";

export const metadata: Metadata = {
  title: "Punto de Venta (POS) — Cendaro",
};

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * POS — Server Component with SSR Prefetch
 *
 * Prefetch lives below a Suspense boundary (required by `cacheComponents`
 * so the segment shell renders instantly — instant-unrendered-segment).
 */
export default function PosPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PosPrefetch />
    </Suspense>
  );
}

async function PosPrefetch() {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(
        trpc.catalog.listProducts.queryOptions({ limit: 100 }),
      ),
      queryClient.prefetchQuery(trpc.catalog.listCategories.queryOptions()),
      queryClient.prefetchQuery(
        trpc.sales.listCustomers.queryOptions({ limit: 100 }),
      ),
      queryClient.prefetchQuery(
        trpc.sales.listOrders.queryOptions({ channel: "store", limit: 100 }),
      ),
      queryClient.prefetchQuery(trpc.inventory.stockOverview.queryOptions({})),
      queryClient.prefetchQuery(trpc.pricing.latestRates.queryOptions()),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PosClient />
    </HydrationBoundary>
  );
}
