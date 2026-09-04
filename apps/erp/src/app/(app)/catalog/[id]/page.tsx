import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import AppLoading from "../../loading";
import ProductDetailClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Product Detail — Server Component with SSR Prefetch
 * The client component reads the id via useParams(); the server prefetches
 * with the same input so the cache is warm on hydration.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<AppLoading />}>
      <ProductDetailPrefetch id={id} />
    </Suspense>
  );
}

async function ProductDetailPrefetch({ id }: { id: string }) {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery(
      trpc.catalog.productById.queryOptions({ id }),
    );
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductDetailClient />
    </HydrationBoundary>
  );
}
