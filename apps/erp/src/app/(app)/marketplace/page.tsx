import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import AppLoading from "../loading";
import MarketplaceClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Marketplace — Server Component with SSR Prefetch
 * Shared queryOptions — same queryKey as the client hooks (options proxy).
 */
export default function MarketplacePage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <MarketplacePrefetch />
    </Suspense>
  );
}

async function MarketplacePrefetch() {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(
        trpc.integrations.listMlListings.queryOptions({ limit: 50 }),
      ),
      queryClient.prefetchQuery(
        trpc.integrations.listMlOrders.queryOptions({ limit: 50 }),
      ),
      queryClient.prefetchQuery(
        trpc.integrations.listLogs.queryOptions({
          source: "mercadolibre",
          limit: 50,
        }),
      ),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MarketplaceClient />
    </HydrationBoundary>
  );
}
