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

import { useCurrentUser } from "~/hooks/use-current-user";

type UserRole = "owner" | "admin" | "supervisor" | "employee" | "vendor" | "marketing";

interface RoleGuardProps {
  /** Roles that are allowed to see the children */
  allow: UserRole[];
  /** Optional fallback UI when role is not allowed */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ allow, fallback = null, children }: RoleGuardProps) {
  const { profile, loading } = useCurrentUser();

  // While loading, render nothing to prevent flicker
  if (loading) return null;

  const userRole = profile?.role as UserRole | undefined;

  if (!userRole || !allow.includes(userRole)) {
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
  allowedRoles: UserRole[],
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole as UserRole);
}
