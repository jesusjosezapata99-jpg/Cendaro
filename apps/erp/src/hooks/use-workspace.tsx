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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate that a value is a standard RFC 4122 UUID */
export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

/** Set workspace ID cookie (client-readable, SameSite=Lax) */
function setWorkspaceCookie(id: string) {
  if (typeof document === "undefined") return;
  if (!isValidUuid(id)) return;
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Read workspace ID from cookie — validates UUID format */
function readWorkspaceCookie(): string | null {
  if (typeof document === "undefined") return null;
  const re = new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`);
  const match = re.exec(document.cookie);
  const val = match?.[1];
  return isValidUuid(val) ? val : null;
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
  // Initialize state strictly from the server-provided initialWorkspaceId if it is a valid UUID.
  // Never branch on `typeof window !== 'undefined'` in initial state to prevent
  // React 19 hydration mismatch errors.
  const safeInitialId = isValidUuid(initialWorkspaceId)
    ? initialWorkspaceId
    : null;
  const [workspaceId, setWorkspaceId] = useState<string | null>(safeInitialId);

  // Sync to localStorage + cookie when workspace changes, or resolve client-side fallback
  useEffect(() => {
    if (isValidUuid(workspaceId)) {
      localStorage.setItem(STORAGE_KEY, workspaceId);
      setWorkspaceCookie(workspaceId);
    } else {
      // Hydration-safe fallback: resolve from validated client cookie or localStorage
      const stored = getWorkspaceId();
      if (isValidUuid(stored)) {
        setWorkspaceId(stored);
      }
    }
  }, [workspaceId]);

  const switchWorkspace = useCallback((id: string) => {
    if (isValidUuid(id)) {
      setWorkspaceId(id);
    }
  }, []);

  const value = useMemo<WorkspaceContext>(
    () => ({
      workspaceId,
      switchWorkspace,
      isReady: isValidUuid(workspaceId),
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
 * Reads from localStorage (client) or cookie (universal), guaranteeing a valid UUID.
 * Automatically purges stale/corrupt values like "undefined" from storage.
 */
export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    if (isValidUuid(stored)) return stored;
    // If localStorage had an invalid string (e.g. "undefined" or malformed), purge it immediately
    localStorage.removeItem(STORAGE_KEY);
  }
  const cookieVal = readWorkspaceCookie();
  return cookieVal;
}

/** Cookie name — exported for server-side reading */
export const WORKSPACE_COOKIE = COOKIE_NAME;
