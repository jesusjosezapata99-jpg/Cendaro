"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { UserRole } from "@cendaro/validators";

import { Dialog } from "~/components/dialog";

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

  // Filter roles: only owner can see/assign owner role
  const availableRoles =
    currentUserRole === "owner"
      ? ALL_ROLES
      : ALL_ROLES.filter((r) => r.value !== "owner");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <Dialog open={open} onClose={onClose} title="Crear Nuevo Usuario">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border-destructive/15 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
            <span className="material-symbols-outlined text-base">error</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Username */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-muted-foreground text-sm">
                alternate_email
              </span>
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
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
          <p className="text-muted-foreground mt-1 text-[10px]">
            El usuario lo usará para iniciar sesión
          </p>
        </div>

        {/* Full Name */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-muted-foreground text-sm">
                person
              </span>
              Nombre Completo
            </span>
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Juan Pérez"
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-muted-foreground text-sm">
                mail
              </span>
              Correo Electrónico
            </span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="juan@ejemplo.com"
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Password */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-muted-foreground text-sm">
                lock
              </span>
              Contraseña
            </span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:ring-2 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
            >
              <span className="material-symbols-outlined text-base">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        {/* Role & Phone in grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-muted-foreground text-sm">
                  badge
                </span>
                Rol
              </span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
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
                <span className="material-symbols-outlined text-muted-foreground text-sm">
                  phone
                </span>
                Teléfono
              </span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+58 412-123..."
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
              Creando usuario...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">
                person_add
              </span>
              Crear Usuario
            </>
          )}
        </button>
      </form>
    </Dialog>
  );
}
