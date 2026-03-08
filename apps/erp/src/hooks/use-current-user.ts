"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@cendaro/auth/client";

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
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

let cachedProfile: UserProfile | null = null;

export function useCurrentUser() {
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);
  const [loading, setLoading] = useState(!cachedProfile);

  useEffect(() => {
    if (cachedProfile) return;

    async function fetchProfile() {
      try {
        const { env } = await import("~/env");
        const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          setLoading(false);
          return;
        }

        const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseKey);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("user_profile")
          .select("id, email, full_name, role, avatar_url")
          .eq("id", user.id)
          .single();

        if (data) {
          const p: UserProfile = {
            id: data.id as string,
            email: data.email as string,
            fullName: data.full_name as string,
            role: data.role as string,
            avatarUrl: data.avatar_url as string | null,
          };
          cachedProfile = p;
          setProfile(p);
        } else {
          // Fallback: use Supabase auth metadata when user_profile row doesn't exist
          const meta = user.user_metadata;
          const fallback: UserProfile = {
            id: user.id,
            email: user.email ?? "usuario@cendaro.com",
            fullName: (meta.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Usuario",
            role: (meta.role as string | undefined) ?? "employee",
            avatarUrl: null,
          };
          cachedProfile = fallback;
          setProfile(fallback);
        }
      } catch {
        // Silently fail — sidebar/topbar will show defaults
      } finally {
        setLoading(false);
      }
    }

    void fetchProfile();
  }, []);

  return {
    profile,
    loading,
    initials: profile
      ? profile.fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "U",
    roleLabel: profile ? (ROLE_LABELS[profile.role] ?? profile.role) : "—",
  };
}
