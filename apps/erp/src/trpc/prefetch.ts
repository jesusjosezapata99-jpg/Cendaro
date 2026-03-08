/**
 * Cendaro — SSR Prefetch Helper
 *
 * Creates a QueryClient with pre-warmed cache for SSR.
 * Use this in Server Components to prefetch tRPC data
 * before the client hydrates — eliminates the loading flash.
 *
 * Usage in page.tsx:
 *   const { queryClient, api } = await createSSRPrefetch();
 *   await queryClient.prefetchQuery({ queryKey: [...], queryFn: () => api.some.procedure() });
 *   return <HydrationBoundary state={dehydrate(queryClient)}><Client /></HydrationBoundary>;
 */
import "server-only";

import { cache } from "react";
import { QueryClient } from "@tanstack/react-query";
import { api } from "./server";

/**
 * Creates a per-request QueryClient paired with the server-side
 * tRPC caller.  React.cache() deduplicates within a single render.
 */
export const createSSRPrefetch = cache(() => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s — matches staleTimes.dynamic in next.config
      },
    },
  });
  return { queryClient, api };
});
