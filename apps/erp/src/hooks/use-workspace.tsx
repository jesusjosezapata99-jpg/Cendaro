"use client";

/**
 * Workspace Context — React provider for multi-tenancy workspace scope.
 *
 * Persists the selected workspace in localStorage and sends `x-workspace-id`
 * header automatically via tRPC. All workspace-scoped components must be
 * wrapped in <WorkspaceProvider>.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "cendaro:workspace-id";

export interface WorkspaceContext {
  /** Currently selected workspace ID */
  workspaceId: string | null;
  /** Switch to a different workspace */
  switchWorkspace: (workspaceId: string) => void;
  /** Whether a workspace is selected */
  isReady: boolean;
}

const Ctx = createContext<WorkspaceContext>({
  workspaceId: null,
  switchWorkspace: () => {
    /* noop — overridden by provider */
  },
  isReady: false,
});

export function WorkspaceProvider({
  children,
  initialWorkspaceId,
}: {
  children: React.ReactNode;
  initialWorkspaceId?: string;
}) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => {
    // SSR-safe: only read localStorage on client
    if (typeof window === "undefined") return initialWorkspaceId ?? null;
    return localStorage.getItem(STORAGE_KEY) ?? initialWorkspaceId ?? null;
  });

  // Sync to localStorage when workspace changes
  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem(STORAGE_KEY, workspaceId);
    }
  }, [workspaceId]);

  const switchWorkspace = useCallback((id: string) => {
    setWorkspaceId(id);
  }, []);

  const value = useMemo<WorkspaceContext>(
    () => ({
      workspaceId,
      switchWorkspace,
      isReady: workspaceId !== null,
    }),
    [workspaceId, switchWorkspace],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Hook to access the current workspace context.
 * Must be used within <WorkspaceProvider>.
 */
export function useWorkspace(): WorkspaceContext {
  return useContext(Ctx);
}

/**
 * Returns the current workspace ID for use in tRPC headers.
 * Used internally by the tRPC client configuration.
 */
export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}
