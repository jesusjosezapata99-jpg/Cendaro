"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "~/hooks/use-debounce";

const EditUserDialog = dynamic(
  () => import("~/components/forms/edit-user").then((m) => ({ default: m.EditUserDialog })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño", admin: "Administrador", supervisor: "Supervisor",
  employee: "Empleado", vendor: "Vendedor", marketing: "Marketing",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-primary",
  supervisor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  employee: "bg-slate-100 text-slate-700 dark:bg-secondary dark:text-muted-foreground",
  vendor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  active: { label: "Activo", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  inactive: { label: "Inactivo", class: "bg-slate-100 text-muted-foreground dark:bg-secondary dark:text-muted-foreground" },
  suspended: { label: "Suspendido", class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export default function UsersPage() {
  const trpc = useTRPC();
  const { data: users, isLoading } = useQuery(trpc.users.list.queryOptions());

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState("");
  const [editingUser, setEditingUser] = useState<null | { id: string; fullName: string; role: string; status: string; phone: string | null }>(null);

  // Client-side filtering
  const filtered = (users ?? []).filter((u) => {
    const matchSearch = !debouncedSearch ||
      u.fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalUsers = users?.length ?? 0;
  const activeCount = users?.filter((u) => u.status === "active").length ?? 0;
  const vendorCount = users?.filter((u) => u.role === "vendor").length ?? 0;
  const suspendedCount = users?.filter((u) => u.status === "suspended").length ?? 0;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            Administra usuarios, roles y permisos del sistema
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Usuarios", value: totalUsers, icon: "group" },
          { label: "Activos", value: activeCount, icon: "check_circle" },
          { label: "Vendedores", value: vendorCount, icon: "badge" },
          { label: "Suspendidos", value: suspendedCount, icon: "warning" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold">{isLoading ? "—" : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Todos los roles</option>
              <option value="owner">Dueño</option>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="employee">Empleado</option>
              <option value="vendor">Vendedor</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Usuario</th>
                <th className="px-6 py-3">Rol</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Creado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-9 w-48" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-28" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-12 ml-auto" /></td>
                    </tr>
                  ))
                : filtered.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {user.fullName.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[user.status]?.class ?? ""}`}>
                          {STATUS_BADGES[user.status]?.label ?? user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("es-VE")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setEditingUser({ id: user.id, fullName: user.fullName, role: user.role, status: user.status, phone: user.phone })}
                          className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
            <p className="text-sm">No se encontraron usuarios</p>
          </div>
        )}
      </div>

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          user={editingUser}
        />
      )}
    </div>
  );
}
