/**
 * Cendaro — RoleGuard Component
 *
 * Client-side RBAC wrapper that conditionally renders children
 * based on the current user's role. Hides content without redirecting.
 *
 * Usage:
 *   <RoleGuard allow={["admin", "owner"]}>
 *     <DangerousButton />
 *   </RoleGuard>
 */
"use client";

import type {
  ErpModule,
  PermissionAction,
  UserRole,
} from "@cendaro/validators";
import { can } from "@cendaro/validators";

import { useCurrentUser } from "~/hooks/use-current-user";

interface RoleGuardProps {
  /** Roles that are allowed to see the children */
  allow: UserRole[];
  /** Optional fallback UI when role is not allowed */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({
  allow,
  fallback = null,
  children,
}: RoleGuardProps) {
  const { profile, loading } = useCurrentUser();

  // While loading, render nothing to prevent flicker
  if (loading) return null;

  const userRole = profile?.role;

  if (!userRole || !allow.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface CanProps {
  module: ErpModule;
  action: PermissionAction;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current role holds `module.action` in the
 * server authorization matrix (ROLE_PERMISSIONS), so an action button is
 * never shown to a role the API would reject. Prefer this over a hardcoded
 * RoleGuard list for anything that calls a gated procedure.
 *
 * Usage:
 *   <Can module="catalog" action="create">
 *     <NewProductButton />
 *   </Can>
 */
export function Can({ module, action, fallback = null, children }: CanProps) {
  const { profile, loading } = useCurrentUser();

  if (loading) return null;

  if (!can(profile?.role, module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Utility: check if a role is allowed in a list.
 * Use this in imperative code (outside of JSX).
 */
export function hasRole(
  userRole: string | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole as UserRole);
}
