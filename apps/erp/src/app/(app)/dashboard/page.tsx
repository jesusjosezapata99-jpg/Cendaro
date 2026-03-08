import { HydrationBoundary, dehydrate, QueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/server";
import DashboardClient from "./client";

/**
 * Dashboard — Server Component with SSR Prefetch
 *
 * Prefetches all 3 dashboard queries in parallel on the server
 * so TanStack Query's cache is pre-warmed before the client hydrates.
 * Eliminates the loading → data flash completely.
 */
export default async function DashboardPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  // Prefetch all 3 dashboard queries in parallel using the server caller
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: [["dashboard", "salesSummary"], { type: "query" }],
      queryFn: () => api.dashboard.salesSummary(),
    }),
    queryClient.prefetchQuery({
      queryKey: [["dashboard", "latestClosures"], { input: { limit: 5 }, type: "query" }],
      queryFn: () => api.dashboard.latestClosures({ limit: 5 }),
    }),
    queryClient.prefetchQuery({
      queryKey: [["dashboard", "activeAlertCount"], { type: "query" }],
      queryFn: () => api.dashboard.activeAlertCount(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
