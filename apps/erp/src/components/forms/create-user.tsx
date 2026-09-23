"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { UserRole } from "@cendaro/validators";
import { Icons } from "@cendaro/ui/icons";

import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
import { getWorkspaceId } from "~/hooks/use-workspace";

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
}

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: "owner", label: "Dueño" },
  { value: "admin", label: "Administrador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "employee", label: "Empleado" },
  { value: "vendor", label: "Vendedor Nacional" },
  { value: "marketing", label: "Marketing" },
];

export function CreateUserDialog({
  open,
  onClose,
  currentUserRole,
}: CreateUserDialogProps) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Mirrors the server rule in /api/auth/create-user: only an owner can
  // create owners or admins.
  const availableRoles =
    currentUserRole === "owner"
      ? ALL_ROLES
      : ALL_ROLES.filter((r) => r.value !== "owner" && r.value !== "admin");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const workspaceId = getWorkspaceId();
      const res = await fetch("/api/auth/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
        },
        body: JSON.stringify({
          username: username.toLowerCase().trim(),
          fullName: fullName.trim(),
          email: email.toLowerCase().trim(),
          password,
          role,
          phone: phone.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string; success?: boolean };

      if (!res.ok) {
        setError(data.error ?? "Error al crear el usuario");
        return;
      }

      // Reset form
      setUsername("");
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("employee");
      setPhone("");

      // Invalidate users list
      void qc.invalidateQueries({ queryKey: [["users"]] });
      onClose();
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="Crear Nuevo Usuario"
      description="Crea una cuenta para un miembro del equipo con acceso al ERP."
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <SheetBody>
          {error && (
            <div className="bg-destructive/10 text-destructive border-destructive/15 flex items-center gap-2 border px-4 py-3 text-sm">
              <Icons.Error className="size-4" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Icons.AlternateEmail className="text-muted-foreground size-3.5" />
                Nombre de Usuario
              </span>
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={128}
              placeholder="ej: juanperez"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
            <p className="text-muted-foreground mt-1 text-[10px]">
              El usuario lo usará para iniciar sesión
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Icons.Person className="text-muted-foreground size-3.5" />
                Nombre Completo
              </span>
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Juan Pérez"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Icons.Mail className="text-muted-foreground size-3.5" />
                Correo Electrónico
              </span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="juan@ejemplo.com"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Icons.Lock className="text-muted-foreground size-3.5" />
                Contraseña
              </span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                placeholder="Mínimo 12 caracteres"
                className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 pr-10 text-sm focus:ring-2 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              >
                {showPassword ? (
                  <Icons.VisibilityOff className="size-4" />
                ) : (
                  <Icons.Visibility className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Role & Phone in grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Icons.Badge className="text-muted-foreground size-3.5" />
                  Rol
                </span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="border-border bg-background w-full border px-3 py-2 text-sm"
              >
                {availableRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Icons.Phone className="text-muted-foreground size-3.5" />
                  Teléfono
                </span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+58 412-123..."
                className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetFormActions
            onCancel={onClose}
            submitting={loading}
            submitLabel="Crear Usuario"
          />
        </SheetFooter>
      </form>
    </SheetModal>
  );
}

export const CreateUserSheet = CreateUserDialog;
