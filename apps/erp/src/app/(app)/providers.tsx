"use client";

import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { InactivityTracker } from "~/components/auth/inactivity-tracker";
import { WorkspaceAutoResolver } from "~/components/workspace-auto-resolver";
import { WorkspaceProvider } from "~/hooks/use-workspace";
import { TRPCProvider } from "~/trpc/client";

export function Providers({
  children,
  initialWorkspaceId,
  dehydratedState,
}: {
  children: React.ReactNode;
  initialWorkspaceId?: string;
  dehydratedState?: DehydratedState;
}) {
  return (
    <TRPCProvider>
      <HydrationBoundary state={dehydratedState}>
        <WorkspaceProvider initialWorkspaceId={initialWorkspaceId}>
          {/* Requires the ancestor <Suspense> already in app/(app)/layout.tsx
              — `cacheComponents: true` needs `useSearchParams()` consumers
              (nuqs hooks, T2.13) to sit under one. */}
          <NuqsAdapter>
            <WorkspaceAutoResolver>
              <InactivityTracker timeoutMinutes={15} warningMinutes={2} />
              {children}
            </WorkspaceAutoResolver>
          </NuqsAdapter>
        </WorkspaceProvider>
      </HydrationBoundary>
    </TRPCProvider>
  );
}
