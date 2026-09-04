import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import AppLoading from "../../../loading";
import WarehouseDetailClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Warehouse Detail — Server Component with SSR Prefetch
 * The client component reads the id via useParams(); the server prefetches
 * with the same inputs so the cache is warm on hydration. The client's
 * initial stock input is { warehouseId: id, search: undefined } — the
 * undefined field is dropped from the cache hash, so keys match.
 */
export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<AppLoading />}>
      <WarehouseDetailPrefetch id={id} />
    </Suspense>
  );
}

async function WarehouseDetailPrefetch({ id }: { id: string }) {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(
        trpc.inventory.getWarehouseDetail.queryOptions({ id }),
      ),
      queryClient.prefetchQuery(
        trpc.inventory.warehouseStock.queryOptions({ warehouseId: id }),
      ),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WarehouseDetailClient />
    </HydrationBoundary>
  );
}
