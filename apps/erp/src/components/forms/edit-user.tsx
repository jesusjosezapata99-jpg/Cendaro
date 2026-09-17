"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { UserRole } from "@cendaro/validators";
import { Icons } from "@cendaro/ui/icons";

import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
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
      onMutate: async (variables) => {
        await qc.cancelQueries({ queryKey: [["users"]] });
        const queryKey = trpc.users.list.queryKey();
        const previousUsers = qc.getQueryData(queryKey);
        if (previousUsers) {
          qc.setQueryData(queryKey, (old) =>
            old
              ? old.map((u) =>
                  u.id === variables.id
                    ? {
                        ...u,
                        ...(variables.fullName
                          ? { fullName: variables.fullName }
                          : {}),
                        ...(variables.role ? { role: variables.role } : {}),
                        ...(variables.status
                          ? { status: variables.status }
                          : {}),
                        ...(variables.phone !== undefined
                          ? { phone: variables.phone }
                          : {}),
                      }
                    : u,
                )
              : old,
          );
        }
        toast.success("Usuario actualizado");
        onClose();
        return { previousUsers, queryKey };
      },
      onError: (err, _variables, context) => {
        if (context?.queryKey && context.previousUsers) {
          qc.setQueryData(context.queryKey, context.previousUsers);
        }
        toast.error(err.message || "Error al actualizar usuario");
      },
      onSettled: async () => {
        await qc.invalidateQueries({ queryKey: [["users"]] });
      },
    }),
  );

  // Mirrors the server rules in users.update: an owner's role is never
  // editable here, only an owner can modify an admin, and only an owner can
  // assign the owner or admin roles.
  const isCallerOwner = currentUserRole === "owner";
  const isRoleDisabled =
    user.role === "owner" || (user.role === "admin" && !isCallerOwner);
  const availableRoles = isCallerOwner
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => r.value !== "owner" && r.value !== "admin");

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title={`Editar — ${user.fullName}`}
    >
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
        className="flex h-full flex-col"
      >
        <SheetBody>
          {update.error && (
            <div className="bg-destructive/10 text-destructive border-destructive/15 flex items-center gap-2 border px-4 py-3 text-sm">
              <Icons.Error className="size-4" />
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
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Rol</label>
            {isRoleDisabled ? (
              <div>
                <div className="border-border bg-secondary text-muted-foreground flex w-full items-center gap-2 border px-3 py-2 text-sm">
                  <Icons.Lock className="size-3" />
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
                className="border-border bg-background w-full border px-3 py-2 text-sm"
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
              className="border-border bg-background w-full border px-3 py-2 text-sm"
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
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetFormActions
            onCancel={onClose}
            submitting={update.isPending}
            submitLabel="Guardar Cambios"
          />
        </SheetFooter>
      </form>
    </SheetModal>
  );
}

export const EditUserSheet = EditUserDialog;
