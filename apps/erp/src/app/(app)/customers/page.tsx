import { HydrationBoundary, dehydrate, QueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/server";
import CustomersClient from "./client";

/**
 * Customers — Server Component with SSR Prefetch
 *
 * Prefetches the customer list so the table renders immediately.
 */
export default async function CustomersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  await queryClient.prefetchQuery({
    queryKey: [["sales", "listCustomers"], { input: { limit: 50 }, type: "query" }],
    queryFn: () => api.sales.listCustomers({ limit: 50 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomersClient />
    </HydrationBoundary>
  );
}
