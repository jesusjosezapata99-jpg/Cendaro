import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import InventoryClient from "./client";

/**
 * Inventory — Server Component with SSR Prefetch
 *
 * Prefetches stock overview, channel summary, and warehouses in parallel
 * so TanStack Query's cache is pre-warmed before the client hydrates.
 */
export default async function InventoryPage() {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: [
          ["inventory", "stockOverview"],
          { input: {}, type: "query" },
        ],
        queryFn: () => api.inventory.stockOverview({}),
      }),
      queryClient.prefetchQuery({
        queryKey: [
          ["inventory", "channelSummary"],
          { input: {}, type: "query" },
        ],
        queryFn: () => api.inventory.channelSummary(),
      }),
      queryClient.prefetchQuery({
        queryKey: [
          ["inventory", "listWarehouses"],
          { input: {}, type: "query" },
        ],
        queryFn: () => api.inventory.listWarehouses(),
      }),
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
