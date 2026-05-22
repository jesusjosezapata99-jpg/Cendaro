"use client";

import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";

import { WorkspaceAutoResolver } from "~/components/workspace-auto-resolver";
import { WorkspaceProvider } from "~/hooks/use-workspace";
import { TRPCProvider } from "~/trpc/client";

function _PageSkeleton() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        <p className="text-muted-foreground text-xs">Cargando…</p>
      </div>
    </div>
  );
}

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
      {dehydratedState ? (
        <HydrationBoundary state={dehydratedState}>
          <WorkspaceProvider initialWorkspaceId={initialWorkspaceId}>
            <WorkspaceAutoResolver>{children}</WorkspaceAutoResolver>
          </WorkspaceProvider>
        </HydrationBoundary>
      ) : (
        <WorkspaceProvider initialWorkspaceId={initialWorkspaceId}>
          <WorkspaceAutoResolver>{children}</WorkspaceAutoResolver>
        </WorkspaceProvider>
      )}
    </TRPCProvider>
  );
}
