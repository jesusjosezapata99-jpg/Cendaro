"use client";

import { useMemo } from "react";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@cendaro/validators";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  supervisor: "Supervisor",
  employee: "Empleado",
  vendor: "Vendedor",
  marketing: "Marketing",
};

/**
 * Hook to get the current user's profile.
 *
 * Uses tRPC + TanStack Query for automatic caching, stale-while-revalidate,
 * and proper invalidation when user data changes (e.g., role update).
 *
 * Previously used a module-level `cachedProfile` variable that was never
 * invalidated — if a user's role changed, they saw stale data until hard refresh.
 */
export function useCurrentUser() {
  const trpc = useTRPC();

  const { data: profile, isLoading: loading } = useQuery(
    trpc.users.me.queryOptions(undefined, {
      staleTime: 5 * 60 * 1000, // 5 min — user data rarely changes mid-session
      gcTime: 30 * 60 * 1000,   // 30 min — keep in cache for session duration
      retry: 1,
    }),
  );

  const mapped: UserProfile | null = useMemo(() => {
    if (!profile) return null;
    return {
      id: profile.id,
      email: profile.email,
      username: profile.email.split("@")[0] ?? "usuario",
      fullName: profile.fullName,
      role: profile.role,
      avatarUrl: profile.avatarUrl ?? null,
    };
  }, [profile]);

  return {
    profile: mapped,
    loading,
    initials: mapped
      ? mapped.fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "U",
    roleLabel: mapped ? (ROLE_LABELS[mapped.role] ?? mapped.role) : "—",
  };
}
