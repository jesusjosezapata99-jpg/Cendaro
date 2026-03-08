import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import CatalogClient from "./client";

/**
 * Catalog — Server Component with SSR Prefetch
 */
export default async function CatalogPage() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: [["catalog", "listProducts"], { input: { limit: 25, offset: 0 }, type: "query" }],
      queryFn: () => api.catalog.listProducts({ limit: 25, offset: 0 }),
    });
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CatalogClient />
    </HydrationBoundary>
  );
}
