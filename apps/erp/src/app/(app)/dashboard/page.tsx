import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import DashboardClient from "./client";

/**
 * Dashboard — Server Component with SSR Prefetch
 *
 * Prefetches all 3 dashboard queries in parallel on the server
 * so TanStack Query's cache is pre-warmed before the client hydrates.
 */
export default async function DashboardPage() {
  const queryClient = getQueryClient();

  // Prefetch in parallel — wrapped in try/catch so build doesn't fail
  // when env vars are unavailable (e.g. during static analysis)
  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: [["dashboard", "salesSummary"], { type: "query" }],
        queryFn: () => api.dashboard.salesSummary(),
      }),
      queryClient.prefetchQuery({
        queryKey: [
          ["dashboard", "latestClosures"],
          { input: { limit: 5 }, type: "query" },
        ],
        queryFn: () => api.dashboard.latestClosures({ limit: 5 }),
      }),
      queryClient.prefetchQuery({
        queryKey: [["dashboard", "activeAlertCount"], { type: "query" }],
        queryFn: () => api.dashboard.activeAlertCount(),
      }),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
