"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
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

const ROLE_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  owner: { label: "Dueño", tone: "primary" },
  admin: { label: "Administrador", tone: "primary" },
  supervisor: { label: "Supervisor", tone: "warning" },
  employee: { label: "Empleado", tone: "neutral" },
  vendor: { label: "Vendedor Nacional", tone: "success" },
  marketing: { label: "Marketing", tone: "primary" },
};

const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Activo", tone: "success" },
  inactive: { label: "Inactivo", tone: "neutral" },
  suspended: { label: "Suspendido", tone: "destructive" },
};

export default function UsersPage() {
  const trpc = useTRPC();
  const { profile: currentUser } = useCurrentUser();
  const currentUserRole = currentUser?.role ?? "employee";
  const canCreate = currentUserRole === "owner" || currentUserRole === "admin";

  const {
    data: users,
    isLoading,
    refetch,
  } = useQuery(trpc.users.list.queryOptions());

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<null | {
    id: string;
    fullName: string;
    role: string;
    status: string;
    phone: string | null;
  }>(null);

  const rawUsers = useMemo(() => users ?? [], [users]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return rawUsers.filter((u) => {
      const matchSearch =
        !debouncedSearch ||
        u.fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus = !statusFilter || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [rawUsers, debouncedSearch, roleFilter, statusFilter]);

  const totalUsers = rawUsers.length;
  const activeCount = rawUsers.filter((u) => u.status === "active").length;
  const vendorCount = rawUsers.filter((u) => u.role === "vendor").length;
  const suspendedCount = rawUsers.filter(
    (u) => u.status === "suspended",
  ).length;

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Header */}
      <PageHeader
        title="Gestión de Usuarios & Control de Acceso"
        description="Administración de cuentas comerciales, roles jerárquicos y estados operativos del sistema"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              className="border-border bg-secondary text-foreground hover:bg-accent flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-xs transition-colors"
            >
              <Icons.Refresh className="size-3.5" />
              Actualizar
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium shadow-xs transition-colors"
              >
                <Icons.PersonAdd className="size-3.5" />
                Nuevo Usuario
              </button>
            )}
          </div>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Usuarios"
          value={isLoading ? "—" : totalUsers}
          icon="Group"
          tone="default"
          sub="Cuentas registradas"
        />
        <StatCard
          label="Usuarios Activos"
          value={isLoading ? "—" : activeCount}
          icon="CheckCircle"
          tone="success"
          sub="Con acceso operativo"
        />
        <StatCard
          label="Fuerza de Ventas"
          value={isLoading ? "—" : vendorCount}
          icon="Badge"
          tone="primary"
          sub="Vendedores nacionales"
        />
        <StatCard
          label="Cuentas Suspendidas"
          value={isLoading ? "—" : suspendedCount}
          icon="Warning"
          tone={suspendedCount > 0 ? "destructive" : "default"}
          sub={suspendedCount > 0 ? "Acceso revocado" : "Cero bloqueos"}
        />
      </div>

      {/* Search and Filters */}
      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Icons.Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-background placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border py-2 pr-3 pl-9 text-xs focus:ring-2 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border-border bg-background text-foreground focus:ring-primary/20 rounded-lg border px-3 py-2 text-xs focus:ring-2 focus:outline-none"
          >
            <option value="">Todos los roles</option>
            <option value="owner">Dueño</option>
            <option value="admin">Administrador</option>
            <option value="supervisor">Supervisor</option>
            <option value="employee">Empleado</option>
            <option value="vendor">Vendedor Nacional</option>
            <option value="marketing">Marketing</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-border bg-background text-foreground focus:ring-primary/20 rounded-lg border px-3 py-2 text-xs focus:ring-2 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="suspended">Suspendido</option>
          </select>

          {(search || roleFilter || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                setStatusFilter("");
              }}
              className="text-muted-foreground hover:text-foreground px-2 text-xs underline underline-offset-4"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Users List / Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon="PersonOff"
            title="No se encontraron usuarios"
            description={
              search || roleFilter || statusFilter
                ? "No hay cuentas que coincidan con los criterios de búsqueda seleccionados."
                : "No hay usuarios registrados en el sistema."
            }
          />
        </div>
      ) : (
        <>
          {/* Mobile tactile cards */}
          <div className="space-y-2.5 md:hidden">
            {filtered.map((user) => {
              const roleCfg = ROLE_CONFIG[user.role] ?? {
                label: user.role,
                tone: "neutral" as StatusTone,
              };
              const statusCfg = STATUS_CONFIG[user.status] ?? {
                label: user.status,
                tone: "neutral" as StatusTone,
              };

              return (
                <div key={user.id} className="surface-card space-y-3 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase">
                        {user.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-medium">
                          {user.fullName}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {user.email}
                        </p>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          @{user.username}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge tone={statusCfg.tone}>
                        {statusCfg.label}
                      </StatusBadge>
                      <StatusBadge tone={roleCfg.tone} dot={false}>
                        {roleCfg.label}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="border-border/50 flex items-center justify-between border-t pt-2 text-[11px]">
                    <span className="text-muted-foreground font-mono tabular-nums">
                      Registro:{" "}
                      {new Date(user.createdAt).toLocaleDateString("es-VE")}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingUser({
                          id: user.id,
                          fullName: user.fullName,
                          role: user.role,
                          status: user.status,
                          phone: user.phone,
                        })
                      }
                      className="border-border bg-secondary text-foreground hover:bg-accent inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      <Icons.Edit className="size-3.5" />
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop structured table */}
          <div className="surface-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[10px] font-medium tracking-wider uppercase">
                    <th className="px-6 py-3.5">Usuario</th>
                    <th className="px-6 py-3.5">Identificador</th>
                    <th className="px-6 py-3.5">Rol de Acceso</th>
                    <th className="px-6 py-3.5">Estado</th>
                    <th className="px-6 py-3.5">Fecha Alta</th>
                    <th className="px-6 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((user) => {
                    const roleCfg = ROLE_CONFIG[user.role] ?? {
                      label: user.role,
                      tone: "neutral" as StatusTone,
                    };
                    const statusCfg = STATUS_CONFIG[user.status] ?? {
                      label: user.status,
                      tone: "neutral" as StatusTone,
                    };

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase">
                              {user.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                            <div className="min-w-0">
                              <p className="text-foreground text-xs font-medium">
                                {user.fullName}
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-secondary text-foreground border-border/50 rounded border px-2 py-0.5 font-mono text-[11px]">
                            @{user.username}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge tone={roleCfg.tone} dot={false}>
                            {roleCfg.label}
                          </StatusBadge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge tone={statusCfg.tone}>
                            {statusCfg.label}
                          </StatusBadge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-muted-foreground font-mono text-xs tabular-nums">
                            {new Date(user.createdAt).toLocaleDateString(
                              "es-VE",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingUser({
                                id: user.id,
                                fullName: user.fullName,
                                role: user.role,
                                status: user.status,
                                phone: user.phone,
                              })
                            }
                            className="text-primary hover:bg-primary/10 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                          >
                            <Icons.Edit className="size-3.5" />
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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
          open={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          currentUserRole={currentUserRole}
          user={editingUser}
        />
      )}
    </div>
  );
}
