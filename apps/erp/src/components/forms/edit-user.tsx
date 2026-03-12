"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UserRole } from "@cendaro/validators";

import { Dialog } from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

interface EditUserDialogProps {
  open: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  user: {
    id: string;
    fullName: string;
    role: string;
    status: string;
    phone: string | null;
  };
}

const ALL_ROLES: { value: string; label: string }[] = [
  { value: "owner", label: "Dueño" },
  { value: "admin", label: "Administrador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "employee", label: "Empleado" },
  { value: "vendor", label: "Vendedor Nacional" },
  { value: "marketing", label: "Marketing" },
];

export function EditUserDialog({
  open,
  onClose,
  currentUserRole,
  user,
}: EditUserDialogProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [phone, setPhone] = useState(user.phone ?? "");

  useEffect(() => {
    setFullName(user.fullName);
    setRole(user.role);
    setStatus(user.status);
    setPhone(user.phone ?? "");
  }, [user]);

  const update = useMutation(
    trpc.users.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["users"]] });
        onClose();
      },
    }),
  );

  // Owner-protection logic for UI
  const isTargetOwner = user.role === "owner";
  const isCallerOwner = currentUserRole === "owner";

  // Determine if role dropdown should be disabled
  // - Target is owner AND caller is not owner → disabled
  // - Target is owner AND caller is owner (peer protection) → disabled
  const isRoleDisabled = isTargetOwner;

  // Filter available roles
  // - Only owner can see/assign "owner" role
  const availableRoles = isCallerOwner
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => r.value !== "owner");

  return (
    <Dialog open={open} onClose={onClose} title={`Editar — ${user.fullName}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({
            id: user.id,
            fullName: fullName !== user.fullName ? fullName : undefined,
            role:
              role !== user.role
                ? (role as
                    | "owner"
                    | "admin"
                    | "supervisor"
                    | "employee"
                    | "vendor"
                    | "marketing")
                : undefined,
            status:
              status !== user.status
                ? (status as "active" | "inactive" | "suspended")
                : undefined,
            phone: phone !== (user.phone ?? "") ? phone : undefined,
          });
        }}
        className="space-y-4"
      >
        {update.error && (
          <div className="bg-destructive/10 text-destructive border-destructive/15 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
            <span className="material-symbols-outlined text-base">error</span>
            <span className="font-medium">{update.error.message}</span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">
            Nombre Completo
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Rol</label>
          {isRoleDisabled ? (
            <div>
              <div className="border-border bg-secondary text-muted-foreground flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="material-symbols-outlined text-xs">lock</span>
                {ALL_ROLES.find((r) => r.value === user.role)?.label ??
                  user.role}
              </div>
              <p className="text-muted-foreground mt-1 text-[10px]">
                {isCallerOwner
                  ? "No puedes cambiar el rol de otro dueño"
                  : "Solo un dueño puede cambiar el rol de otro dueño"}
              </p>
            </div>
          ) : (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+58 412-1234567"
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={update.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
        >
          {update.isPending ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>
    </Dialog>
  );
}
