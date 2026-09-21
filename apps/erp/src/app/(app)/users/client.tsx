"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useUserParams } from "~/hooks/params/use-user-params";
import { useCurrentUser } from "~/hooks/use-current-user";
import { useDebounce } from "~/hooks/use-debounce";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
  status: string;
  phone: string | null;
  createdAt: Date | string;
}

const ROLE_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  owner: { label: "Dueño", tone: "default" },
  admin: { label: "Administrador", tone: "default" },
  supervisor: { label: "Supervisor", tone: "warning" },
  employee: { label: "Empleado", tone: "neutral" },
  vendor: { label: "Vendedor Nacional", tone: "success" },
  marketing: { label: "Marketing", tone: "info" },
};

export default function UsersPage() {
  const trpc = useTRPC();
  const { profile: currentUser } = useCurrentUser();
  const currentUserRole = currentUser?.role ?? "employee";
  const canCreate = currentUserRole === "owner" || currentUserRole === "admin";

  const [, setUserParams] = useUserParams();

  const {
    data: users,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.users.list.queryOptions());

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const rawUsers = useMemo(
    () => (users ?? []) as unknown as UserItem[],
    [users],
  );

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

  const columns = useMemo<ColumnDef<UserItem>[]>(
    () => [
      {
        id: "user",
        header: "Usuario",
        cell: ({ row }) => {
          const u = row.original;
          const initials = u.fullName
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("");
          return (
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-foreground truncate text-xs font-medium">
                  {u.fullName}
                </p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {u.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "username",
        header: "Identificador",
        cell: ({ row }) => (
          <span className="border-border bg-muted/40 text-foreground border px-2 py-0.5 font-mono text-[11px]">
            @{row.original.username}
          </span>
        ),
      },
      {
        accessorKey: "role",
        header: "Rol de Acceso",
        cell: ({ row }) => {
          const roleCfg = ROLE_CONFIG[row.original.role] ?? {
            label: row.original.role,
            tone: "neutral" as StatusTone,
          };
          return <StatusPill tone={roleCfg.tone}>{roleCfg.label}</StatusPill>;
        },
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Estado</div>,
        cell: ({ row }) => {
          const { label, tone } = getStatus("user", row.original.status);
          return (
            <div className="text-center">
              <StatusPill tone={tone}>{label}</StatusPill>
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Fecha Alta",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void setUserParams({ editUser: row.original.id })}
              className="border-border h-7 px-2 text-xs font-medium"
            >
              <Icons.Edit className="mr-1 size-3.5" />
              Editar
            </Button>
          </div>
        ),
      },
    ],
    [setUserParams],
  );

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Header */}
      <PageHeader
        title="Gestión de Usuarios & Control de Acceso"
        description="Administración de cuentas comerciales, roles jerárquicos y estados operativos del sistema"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void refetch()}
              className="border-border h-9 text-xs font-medium"
            >
              <Icons.Refresh className="mr-1.5 size-3.5" />
              Actualizar
            </Button>
            {canCreate && (
              <Button
                onClick={() => void setUserParams({ createUser: true })}
                className="h-9 text-xs font-medium"
              >
                <Icons.PersonAdd className="mr-1.5 size-3.5" />
                Nuevo Usuario
              </Button>
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
      <div className="border-border bg-card flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Icons.Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-background placeholder:text-muted-foreground focus:border-foreground w-full border py-1.5 pr-3 pl-9 text-xs transition-colors outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border-border bg-background text-foreground focus:border-foreground border px-3 py-1.5 text-xs transition-colors outline-none"
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
            className="border-border bg-background text-foreground focus:border-foreground border px-3 py-1.5 text-xs transition-colors outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
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
        <div className="border-border bg-card border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex h-11.25 animate-pulse items-center border-b px-4 last:border-b-0"
            >
              <div className="bg-muted h-4 w-32" />
              <div className="bg-muted ml-6 h-4 w-24" />
              <div className="bg-muted ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-border bg-card border p-12">
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
              const { label, tone } = getStatus("user", user.status);
              const initials = user.fullName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("");

              return (
                <div
                  key={user.id}
                  className="border-border bg-card space-y-3 border p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase">
                        {initials}
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
                      <StatusPill tone={tone}>{label}</StatusPill>
                      <StatusPill tone={roleCfg.tone}>
                        {roleCfg.label}
                      </StatusPill>
                    </div>
                  </div>

                  <div className="border-border flex items-center justify-between border-t pt-2 text-[11px]">
                    <span className="text-muted-foreground font-mono tabular-nums">
                      Registro:{" "}
                      {new Date(user.createdAt).toLocaleDateString("es-VE")}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void setUserParams({ editUser: user.id })}
                      className="border-border h-7 px-2 text-xs font-medium"
                    >
                      <Icons.Edit className="mr-1 size-3.5" />
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop structured table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filtered}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onResetFilters={
                search || roleFilter || statusFilter
                  ? () => {
                      setSearch("");
                      setRoleFilter("");
                      setStatusFilter("");
                    }
                  : undefined
              }
              emptyTitle="No se encontraron usuarios"
              emptyDescription="No hay cuentas que coincidan con los criterios de búsqueda seleccionados."
            />
          </div>
        </>
      )}
    </div>
  );
}
