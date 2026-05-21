"use client";

import { WorkspaceAutoResolver } from "~/components/workspace-auto-resolver";
import { WorkspaceProvider } from "~/hooks/use-workspace";
import { TRPCProvider } from "~/trpc/client";

function PageSkeleton() {
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
}: {
  children: React.ReactNode;
  initialWorkspaceId?: string;
}) {
  return (
    <TRPCProvider>
      <WorkspaceProvider initialWorkspaceId={initialWorkspaceId}>
        <WorkspaceAutoResolver fallback={<PageSkeleton />}>
          {children}
        </WorkspaceAutoResolver>
      </WorkspaceProvider>
    </TRPCProvider>
  );
}
