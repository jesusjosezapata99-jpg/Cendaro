import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { DashboardSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import DashboardClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Dashboard — Server Component with SSR Prefetch
 *
 * Prefetches all 3 dashboard queries in parallel on the server
 * so TanStack Query's cache is pre-warmed before the client hydrates.
 *
 * The prefetch performs dynamic IO, so it lives below a Suspense
 * boundary — required by `cacheComponents` so the segment shell can
 * render instantly (see: instant-unrendered-segment, Next error E1286).
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPrefetch />
    </Suspense>
  );
}

async function DashboardPrefetch() {
  const queryClient = getQueryClient();

  // Prefetch in parallel — wrapped in try/catch so build doesn't fail
  // when env vars are unavailable (e.g. during static analysis)
  // Shared queryOptions — same queryKey as the client hooks (options proxy)
  try {
    await Promise.all([
      queryClient.prefetchQuery(trpc.dashboard.salesSummary.queryOptions()),
      queryClient.prefetchQuery(
        trpc.dashboard.latestClosures.queryOptions({ limit: 5 }),
      ),
      queryClient.prefetchQuery(trpc.dashboard.activeAlertCount.queryOptions()),
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
