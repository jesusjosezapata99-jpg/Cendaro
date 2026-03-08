import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import OrdersClient from "./client";

/**
 * Orders — Server Component with SSR Prefetch
 */
export default async function OrdersPage() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: [["sales", "listOrders"], { input: { limit: 50 }, type: "query" }],
      queryFn: () => api.sales.listOrders({ limit: 50 }),
    });
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersClient />
    </HydrationBoundary>
  );
}
