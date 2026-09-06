import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { DetailSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import OrderDetailClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Order Detail — Server Component with SSR Prefetch
 * The client component reads the id via useParams(); the server prefetches
 * with the same input so the cache is warm on hydration.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <OrderDetailPrefetch id={id} />
    </Suspense>
  );
}

async function OrderDetailPrefetch({ id }: { id: string }) {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery(trpc.sales.orderById.queryOptions({ id }));
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderDetailClient />
    </HydrationBoundary>
  );
}
