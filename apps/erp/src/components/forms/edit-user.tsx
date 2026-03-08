"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "~/components/dialog";

interface EditUserDialogProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    fullName: string;
    role: string;
    status: string;
    phone: string | null;
  };
}

export function EditUserDialog({ open, onClose, user }: EditUserDialogProps) {
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

  return (
    <Dialog open={open} onClose={onClose} title={`Editar — ${user.fullName}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({
            id: user.id,
            fullName: fullName !== user.fullName ? fullName : undefined,
            role: role !== user.role ? (role as "owner" | "admin" | "supervisor" | "employee" | "vendor" | "marketing") : undefined,
            status: status !== user.status ? (status as "active" | "inactive" | "suspended") : undefined,
            phone: phone !== (user.phone ?? "") ? phone : undefined,
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre Completo</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="owner">Dueño</option>
            <option value="admin">Administrador</option>
            <option value="supervisor">Supervisor</option>
            <option value="employee">Empleado</option>
            <option value="vendor">Vendedor</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 412-1234567" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button type="submit" disabled={update.isPending} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {update.isPending ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>
    </Dialog>
  );
}
