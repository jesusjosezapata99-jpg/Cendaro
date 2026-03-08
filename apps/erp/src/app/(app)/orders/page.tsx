import { HydrationBoundary, dehydrate, QueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/server";
import OrdersClient from "./client";

/**
 * Orders — Server Component with SSR Prefetch
 *
 * Prefetches the initial orders listing (no status filter)
 * so the table renders immediately on hydration.
 */
export default async function OrdersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  await queryClient.prefetchQuery({
    queryKey: [["sales", "listOrders"], { input: { limit: 50 }, type: "query" }],
    queryFn: () => api.sales.listOrders({ limit: 50 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersClient />
    </HydrationBoundary>
  );
}
