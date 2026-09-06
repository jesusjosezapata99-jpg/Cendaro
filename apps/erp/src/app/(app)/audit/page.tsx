import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import AuditClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Audit — Server Component with SSR Prefetch
 * Shared queryOptions — same queryKey as the client hooks (options proxy).
 * The client's initial input is { limit: 50, entity: undefined } — the
 * undefined field is dropped from the cache hash, so keys match.
 */
export default function AuditPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AuditPrefetch />
    </Suspense>
  );
}

async function AuditPrefetch() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery(
      trpc.audit.list.queryOptions({ limit: 50 }),
    );
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AuditClient />
    </HydrationBoundary>
  );
}
