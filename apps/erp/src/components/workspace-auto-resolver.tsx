"use client";

/**
 * WorkspaceAutoResolver — Resolves workspace on first login / cache clear.
 *
 * Must be rendered INSIDE both <TRPCProvider> and <WorkspaceProvider>.
 * When no workspace is stored (first login, cache clear, new device),
 * fetches the user's workspace list and auto-selects the first one.
 * Renders children only when a workspace is resolved (isReady = true).
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "~/hooks/use-workspace";
import { useTRPC } from "~/trpc/client";

export function WorkspaceAutoResolver({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { switchWorkspace, isReady } = useWorkspace();
  const trpc = useTRPC();
  const didResolve = useRef(false);

  // Only fetch workspaces when we DON'T have one stored
  const { data: workspaces } = useQuery(
    trpc.workspace.list.queryOptions(undefined, {
      enabled: !isReady && !didResolve.current,
      staleTime: Infinity,
      retry: 2,
    }),
  );

  useEffect(() => {
    // Already resolved or already have a workspace — skip
    if (isReady || didResolve.current) return;

    if (workspaces && workspaces.length > 0) {
      didResolve.current = true;
      // Pick the first active workspace
      const first = workspaces[0];
      if (first) {
        switchWorkspace(first.id);
      }
    }
  }, [workspaces, isReady, switchWorkspace]);

  // Gate: wait until workspace is resolved before rendering children
  if (!isReady) {
    return <>{fallback ?? null}</>;
  }

  return <>{children}</>;
}
