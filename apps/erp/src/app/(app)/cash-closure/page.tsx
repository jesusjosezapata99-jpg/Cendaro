import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import CashClosureClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Cash Closure — Server Component with SSR Prefetch
 * Shared queryOptions — same queryKey as the client hooks (options proxy).
 */
export default function CashClosurePage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CashClosurePrefetch />
    </Suspense>
  );
}

async function CashClosurePrefetch() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery(trpc.sales.listClosures.queryOptions());
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CashClosureClient />
    </HydrationBoundary>
  );
}
