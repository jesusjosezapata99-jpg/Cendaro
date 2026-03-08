import { HydrationBoundary, dehydrate, QueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/server";
import CatalogClient from "./client";

/**
 * Catalog — Server Component with SSR Prefetch
 *
 * Prefetches the initial product listing (first page, no filters)
 * so the table renders immediately on hydration.
 */
export default async function CatalogPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  await queryClient.prefetchQuery({
    queryKey: [["catalog", "listProducts"], { input: { limit: 25, offset: 0 }, type: "query" }],
    queryFn: () => api.catalog.listProducts({ limit: 25, offset: 0 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CatalogClient />
    </HydrationBoundary>
  );
}
