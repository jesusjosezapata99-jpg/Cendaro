import { Suspense } from "react";
import { cookies } from "next/headers";
import { dehydrate } from "@tanstack/react-query";

import { WORKSPACE_COOKIE } from "~/hooks/use-workspace";
import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import { AppShell } from "./app-shell";
import { Providers } from "./providers";

async function WorkspaceLoader({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  // SSR prefetch shell data so sidebar + topbar + rates render instantly
  const queryClient = getQueryClient();
  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: [["users", "me"], { type: "query" }],
        queryFn: () => api.users.me(),
      }),
      queryClient.prefetchQuery({
        queryKey: [["workspace", "list"], { type: "query" }],
        queryFn: () => api.workspace.list(),
      }),
      queryClient.prefetchQuery({
        queryKey: [
          ["pricing", "latestRates"],
          { input: undefined, type: "query" },
        ],
        queryFn: () => api.pricing.latestRates(),
      }),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <Providers
      initialWorkspaceId={workspaceId}
      dehydratedState={dehydrate(queryClient)}
    >
      <AppShell>{children}</AppShell>
    </Providers>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <WorkspaceLoader>{children}</WorkspaceLoader>
    </Suspense>
  );
}
