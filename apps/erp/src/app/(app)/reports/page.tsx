import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import ReportsClient from "./client";

export const instant = false;

export default function ReportsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ReportsPrefetch />
    </Suspense>
  );
}

async function ReportsPrefetch() {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(
        trpc.reporting.inventoryValuation.queryOptions(),
      ),
      queryClient.prefetchQuery(
        trpc.reporting.reconcileFinancialLedger.queryOptions(),
      ),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReportsClient />
    </HydrationBoundary>
  );
}
