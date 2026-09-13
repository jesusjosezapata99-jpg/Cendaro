"use client";

import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { NAV_ROLE_RULES } from "@cendaro/validators";

import { hasRole } from "~/components/role-guard";
import { useCurrentUser } from "~/hooks/use-current-user";
import { ThemeSwitch } from "./theme-switch";

/**
 * User menu — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1 (T2.7).
 * `w-60` (240px), `align="end" sideOffset={10}`: name + email, then
 * Configuración / Auditoría (only owner/admin, per §5.8.3) / Tema
 * (embeds `ThemeSwitch`, T2.8) / Cerrar sesión. Logout logic is unchanged
 * (`POST /api/auth/logout`, redirect on success or failure alike).
 */
export function UserMenu() {
  const router = useRouter();
  const { profile, loading, initials } = useCurrentUser();
  const canSeeAudit = hasRole(profile?.role ?? null, NAV_ROLE_RULES.audit);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // fallback: redirect even if the server call fails
    }
    window.location.href = "/login";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="bg-accent flex size-8 items-center justify-center rounded-full text-sm font-medium"
          aria-label="Menú de usuario"
        >
          {loading ? "…" : initials}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 text-xs font-normal">
          <span className="text-foreground font-medium">
            {profile?.fullName ?? "Usuario"}
          </span>
          <span className="text-muted-foreground">{profile?.email ?? "—"}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          className="text-xs"
        >
          <Icons.Settings className="size-4" />
          Configuración
        </DropdownMenuItem>

        {canSeeAudit && (
          <DropdownMenuItem
            onClick={() => router.push("/audit")}
            className="text-xs"
          >
            <Icons.History className="size-4" />
            Log de Auditoría
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs">Tema</span>
          <ThemeSwitch />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void handleLogout()}
          variant="destructive"
          className="text-xs"
        >
          <Icons.Logout className="size-4" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
