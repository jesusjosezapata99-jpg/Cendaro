import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import CustomersClient from "./client";

/**
 * Customers — Server Component with SSR Prefetch
 */
export default async function CustomersPage() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: [["sales", "listCustomers"], { input: { limit: 50 }, type: "query" }],
      queryFn: () => api.sales.listCustomers({ limit: 50 }),
    });
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomersClient />
    </HydrationBoundary>
  );
}
