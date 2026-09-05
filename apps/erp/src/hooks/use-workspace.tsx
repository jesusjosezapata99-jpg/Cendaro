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
const COOKIE_NAME = "cendaro-workspace-id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Set workspace ID cookie (client-readable, SameSite=Lax) */
function setWorkspaceCookie(id: string) {
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Read workspace ID from cookie */
function readWorkspaceCookie(): string | null {
  const re = new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`);
  const match = re.exec(document.cookie);
  return match?.[1] ?? null;
}

export interface WorkspaceContext {
  /** Currently selected workspace ID */
  workspaceId: string | null;
  /** Switch to a different workspace */
  switchWorkspace: (workspaceId: string) => void;
  /** Whether a workspace is selected and ready for queries */
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
  // Initialize state strictly from the server-provided initialWorkspaceId.
  // Never branch on `typeof window !== 'undefined'` in initial state to prevent
  // React 19 hydration mismatch errors.
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    initialWorkspaceId ?? null,
  );

  // Sync to localStorage + cookie when workspace changes, or resolve client-side fallback
  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem(STORAGE_KEY, workspaceId);
      setWorkspaceCookie(workspaceId);
    } else {
      // Hydration-safe fallback: if SSR rendered without an initial workspace ID
      // (e.g. static shell prerender or first visit before cookie exchange),
      // resolve from client cookie or localStorage after mount to prevent hydration mismatch.
      const stored = readWorkspaceCookie() ?? localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setWorkspaceId(stored);
      }
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
 * Reads from localStorage (client) or cookie (universal).
 */
export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY) ?? readWorkspaceCookie();
}

/** Cookie name — exported for server-side reading */
export const WORKSPACE_COOKIE = COOKIE_NAME;
