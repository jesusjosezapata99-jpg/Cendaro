"use client";

import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";

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
          <WorkspaceAutoResolver>{children}</WorkspaceAutoResolver>
        </WorkspaceProvider>
      </HydrationBoundary>
    </TRPCProvider>
  );
}
