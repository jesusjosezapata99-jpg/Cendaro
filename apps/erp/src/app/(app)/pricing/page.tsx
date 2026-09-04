import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import PricingClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Pricing — Server Component with SSR Prefetch
 * Shared queryOptions — same queryKey as the client hooks (options proxy).
 */
export default function PricingPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PricingPrefetch />
    </Suspense>
  );
}

async function PricingPrefetch() {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(
        trpc.pricing.listRepricingEvents.queryOptions({ limit: 20 }),
      ),
      queryClient.prefetchQuery(
        trpc.pricing.priceHistory.queryOptions({ limit: 50 }),
      ),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PricingClient />
    </HydrationBoundary>
  );
}
