"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "~/hooks/use-current-user";
import { useDebounce } from "~/hooks/use-debounce";
import { useTRPC } from "~/trpc/client";

const EditUserDialog = dynamic(
  () =>
    import("~/components/forms/edit-user").then((m) => ({
      default: m.EditUserDialog,
    })),
  { ssr: false },
);

const CreateUserDialog = dynamic(
  () =>
    import("~/components/forms/create-user").then((m) => ({
      default: m.CreateUserDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  supervisor: "Supervisor",
  employee: "Empleado",
  vendor: "Vendedor Nacional",
  marketing: "Marketing",
};

const ROLE_COLORS: Record<string, string> = {
  owner:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-primary",
  supervisor:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  employee:
    "bg-slate-100 text-slate-700 dark:bg-secondary dark:text-muted-foreground",
  vendor:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  active: {
    label: "Activo",
    class:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  inactive: {
    label: "Inactivo",
    class:
      "bg-slate-100 text-muted-foreground dark:bg-secondary dark:text-muted-foreground",
  },
  suspended: {
    label: "Suspendido",
    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

export default function UsersPage() {
  const trpc = useTRPC();
  const { profile: currentUser } = useCurrentUser();
  const currentUserRole = currentUser?.role ?? "employee";
  const canCreate = currentUserRole === "owner" || currentUserRole === "admin";

  const { data: users, isLoading } = useQuery(trpc.users.list.queryOptions());

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<null | {
    id: string;
    fullName: string;
    role: string;
    status: string;
    phone: string | null;
  }>(null);

  // Client-side filtering
  const filtered = (users ?? []).filter((u) => {
    const matchSearch =
      !debouncedSearch ||
      u.fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalUsers = users?.length ?? 0;
  const activeCount = users?.filter((u) => u.status === "active").length ?? 0;
  const vendorCount = users?.filter((u) => u.role === "vendor").length ?? 0;
  const suspendedCount =
    users?.filter((u) => u.status === "suspended").length ?? 0;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground">
            Administra usuarios, roles y permisos del sistema
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              person_add
            </span>
            Crear Usuario
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Usuarios", value: totalUsers, icon: "group" },
          { label: "Activos", value: activeCount, icon: "check_circle" },
          { label: "Vendedores", value: vendorCount, icon: "badge" },
          { label: "Suspendidos", value: suspendedCount, icon: "warning" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-border bg-card rounded-xl border p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {isLoading ? "—" : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="border-border border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por nombre, email o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border bg-background placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 w-full max-w-sm rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border-border bg-background rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Todos los roles</option>
              <option value="owner">Dueño</option>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="employee">Empleado</option>
              <option value="vendor">Vendedor Nacional</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs font-medium tracking-wider uppercase">
                <th className="px-6 py-3">Usuario</th>
                <th className="hidden px-6 py-3 sm:table-cell">Username</th>
                <th className="px-6 py-3">Rol</th>
                <th className="px-6 py-3">Estado</th>
                <th className="hidden px-6 py-3 md:table-cell">Creado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <Skeleton className="h-9 w-48" />
                      </td>
                      <td className="hidden px-6 py-4 sm:table-cell">
                        <Skeleton className="h-5 w-24" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-5 w-24" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-5 w-20" />
                      </td>
                      <td className="hidden px-6 py-4 md:table-cell">
                        <Skeleton className="h-5 w-28" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="ml-auto h-5 w-12" />
                      </td>
                    </tr>
                  ))
                : filtered.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full text-sm font-semibold">
                            {user.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {user.fullName}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted-foreground hidden px-6 py-4 text-sm sm:table-cell">
                        <span className="bg-secondary inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs">
                          @{user.username}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? ""}`}
                        >
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[user.status]?.class ?? ""}`}
                        >
                          {STATUS_BADGES[user.status]?.label ?? user.status}
                        </span>
                      </td>
                      <td className="text-muted-foreground hidden px-6 py-4 text-sm md:table-cell">
                        {new Date(user.createdAt).toLocaleDateString("es-VE")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            setEditingUser({
                              id: user.id,
                              fullName: user.fullName,
                              role: user.role,
                              status: user.status,
                              phone: user.phone,
                            })
                          }
                          className="text-primary hover:bg-primary/10 rounded-md px-2 py-1 text-xs font-medium transition-colors"
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
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
            <span className="material-symbols-outlined mb-2 text-4xl">
              person_off
            </span>
            <p className="text-sm">No se encontraron usuarios</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showCreate && (
        <CreateUserDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          currentUserRole={currentUserRole}
        />
      )}

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          currentUserRole={currentUserRole}
          user={editingUser}
        />
      )}
    </div>
  );
}
