"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { AuditEntry } from "~/components/modals/audit-details-dialog";
import { DataTable } from "~/components/data-table/data-table";
import { EmptyState } from "~/components/empty-state";
import { AuditDetailsDialog } from "~/components/modals/audit-details-dialog";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useTRPC } from "~/trpc/client";

const ACTION_ICONS: Record<string, IconName> = {
  "user.create": "PersonAdd",
  "user.update": "Edit",
  "price.update": "AttachMoney",
  "inventory.adjust": "Package2",
  "container.close": "LocalShipping",
  "cash.close": "Lock",
  "rate.update": "TrendingUp",
  "stock.transfer": "SwapHoriz",
  "stock.lock": "Lock",
  "stock.unlock": "LockOpen",
  "repricing.approve": "CheckCircle",
  "payment.create": "Payments",
  "payment.validate": "Verified",
  "commission.pay": "AttachMoney",
  "count.create": "Assignment",
  "count.approve": "TaskAlt",
  "warehouse.create": "Warehouse",
  "ar.create": "ReceiptLong",
  "ar.payment": "Paid",
  "ml.sync": "Sync",
  "ml.import_order": "Inbox",
  "integration.resolve": "Check",
};

const ACTION_TONES: Record<string, StatusTone> = {
  "user.create": "default",
  "user.update": "warning",
  "price.update": "success",
  "inventory.adjust": "warning",
  "container.close": "default",
  "cash.close": "neutral",
  "rate.update": "default",
  "stock.transfer": "neutral",
  "stock.lock": "warning",
  "stock.unlock": "success",
  "repricing.approve": "success",
  "payment.create": "default",
  "payment.validate": "success",
  "commission.pay": "success",
  "count.create": "neutral",
  "count.approve": "success",
  "warehouse.create": "default",
  "ar.create": "warning",
  "ar.payment": "success",
  "ml.sync": "default",
  "ml.import_order": "default",
  "integration.resolve": "success",
};

const SAMPLE_AUDIT_ENTRY: AuditEntry = {
  id: "e4a78c12-98bf-4c56-a123-b567890ef123",
  action: "repricing.approve",
  entity: "pricing_batch",
  entityId: "b890f123-4567-89ab-cdef-0123456789ab",
  actorId: "a1234567-89ab-cdef-0123-456789abcdef",
  actorRole: "owner",
  actorName: "Jesús Zapata",
  oldValue: {
    sku: "ACE-SYN-5W30",
    basePriceUsd: 14.5,
    marginPercent: 25,
    rateBcv: 36.42,
  },
  newValue: {
    sku: "ACE-SYN-5W30",
    basePriceUsd: 16.2,
    marginPercent: 28,
    rateBcv: 39.85,
  },
  metadata: {
    batchId: "BATCH-2026-09-AUTO",
    source: "BCV Automated Monitor",
    approvedVia: "Web Executive Dashboard",
    affectedProducts: 48,
  },
  correlationId: "corr-8f92-4c56",
  ipAddress: "190.202.45.12",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
  createdAt: new Date("2026-09-06T20:30:00Z"),
};

export default function AuditPage() {
  const trpc = useTRPC();
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const {
    data: entries,
    isLoading,
    isError,
    refetch,
  } = useQuery(
    trpc.audit.list.queryOptions({
      limit: 100,
      entity: entityFilter || undefined,
    }),
  );

  const items = useMemo(() => entries ?? [], [entries]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((entry) => {
      const actorMatch = (entry.actorName ?? "").toLowerCase().includes(q);
      const actionMatch = entry.action.toLowerCase().includes(q);
      const entityMatch = entry.entity.toLowerCase().includes(q);
      const entityIdMatch = (entry.entityId ?? "").toLowerCase().includes(q);
      return actorMatch || actionMatch || entityMatch || entityIdMatch;
    });
  }, [items, search]);

  const uniqueEntities = useMemo(
    () => new Set(items.map((i) => i.entity)).size,
    [items],
  );
  const uniqueActors = useMemo(
    () => new Set(items.map((i) => i.actorName ?? "Sistema")).size,
    [items],
  );
  const criticalEventsCount = useMemo(
    () =>
      items.filter(
        (i) =>
          i.action.includes("delete") ||
          i.action.includes("close") ||
          i.action.includes("approve") ||
          i.action.includes("lock"),
      ).length,
    [items],
  );

  const columns = useMemo<ColumnDef<AuditEntry>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha y Hora",
        cell: ({ row }) => (
          <time className="text-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleString("es-VE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
        ),
      },
      {
        accessorKey: "action",
        header: "Acción",
        cell: ({ row }) => {
          const entry = row.original;
          const tone = ACTION_TONES[entry.action] ?? "neutral";
          const iconName = ACTION_ICONS[entry.action] ?? "Description";
          return (
            <div className="flex items-center gap-2">
              <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center">
                <Icon name={iconName} className="size-3" />
              </span>
              <StatusPill tone={tone}>{entry.action}</StatusPill>
            </div>
          );
        },
      },
      {
        accessorKey: "entity",
        header: "Entidad Afectada",
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-foreground font-medium">
                {entry.entity}
              </span>
              {entry.entityId ? (
                <span className="text-muted-foreground max-w-30 truncate font-mono text-[11px]">
                  ({entry.entityId.slice(0, 8)}…)
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actor",
        header: "Actor / Rol",
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-foreground font-medium">
                {entry.actorName ?? "Sistema"}
              </span>
              {entry.actorRole ? (
                <span className="border-border bg-muted/40 text-muted-foreground border px-1.5 py-0.5 font-mono text-[10px] uppercase">
                  {entry.actorRole}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Detalles</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEntry(row.original)}
              className="border-border h-7 px-2 text-xs font-medium"
            >
              <Icons.Visibility className="mr-1 size-3.5" />
              Inspeccionar
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Header */}
      <PageHeader
        title="Log de Auditoría & Gobernanza"
        description="Trazabilidad forense inmutable de todas las mutaciones y eventos operacionales del ERP"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              id="btn-inspect-model"
              onClick={() => setSelectedEntry(SAMPLE_AUDIT_ENTRY)}
              className="border-border h-9 text-xs font-medium"
            >
              <Icons.Preview className="mr-1.5 size-3.5" />
              Modelo Inspector
            </Button>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              className="border-border h-9 text-xs font-medium"
            >
              <Icons.Refresh className="mr-1.5 size-3.5" />
              Actualizar
            </Button>
          </div>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Eventos Registrados"
          value={isLoading ? "—" : items.length}
          icon="History"
          tone="default"
          sub="Últimos 100 logs"
        />
        <StatCard
          label="Entidades Auditadas"
          value={isLoading ? "—" : uniqueEntities}
          icon="Database"
          tone="primary"
          sub="Tablas & recursos"
        />
        <StatCard
          label="Actores Únicos"
          value={isLoading ? "—" : uniqueActors}
          icon="Group"
          tone="default"
          sub="Usuarios y procesos"
        />
        <StatCard
          label="Eventos Críticos"
          value={isLoading ? "—" : criticalEventsCount}
          icon="Shield"
          tone={criticalEventsCount > 0 ? "warning" : "success"}
          sub="Aprobaciones & cierres"
        />
      </div>

      {/* Filters & Search */}
      <div className="border-border bg-card flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Icons.Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por actor, acción, entidad o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-background placeholder:text-muted-foreground focus:border-foreground w-full border py-1.5 pr-3 pl-9 text-xs transition-colors outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border-border bg-background text-foreground focus:border-foreground border px-3 py-1.5 text-xs transition-colors outline-none"
          >
            <option value="">Todas las entidades</option>
            <option value="user_profile">Usuarios</option>
            <option value="product">Productos</option>
            <option value="stock_ledger">Inventario</option>
            <option value="stock_movement">Movimientos</option>
            <option value="container">Contenedores</option>
            <option value="cash_closure">Caja</option>
            <option value="exchange_rate">Tasas</option>
            <option value="repricing_event">Repricing</option>
            <option value="payment">Pagos</option>
            <option value="vendor_commission">Comisiones</option>
            <option value="warehouse">Almacenes</option>
            <option value="inventory_count">Conteos</option>
            <option value="account_receivable">CxC</option>
            <option value="ml_listing">ML Listings</option>
            <option value="ml_order">ML Órdenes</option>
            <option value="integration_log">Integraciones</option>
          </select>

          {(search || entityFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setEntityFilter("");
              }}
              className="text-muted-foreground hover:text-foreground px-2 text-xs underline underline-offset-4"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Audit List / Table */}
      {isLoading ? (
        <div className="border-border bg-card border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex h-11.25 animate-pulse items-center border-b px-4 last:border-b-0"
            >
              <div className="bg-muted h-4 w-36" />
              <div className="bg-muted ml-6 h-4 w-28" />
              <div className="bg-muted ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="border-border bg-card border p-12">
          <EmptyState
            icon="History"
            title="No se encontraron registros de auditoría"
            description={
              search || entityFilter
                ? "No hay eventos que coincidan con los filtros aplicados."
                : "El registro de auditoría no contiene eventos recientes en este entorno."
            }
            action={
              <Button
                variant="outline"
                onClick={() => setSelectedEntry(SAMPLE_AUDIT_ENTRY)}
                className="mt-2"
              >
                <Icons.Visibility className="mr-1.5 size-3.5" />
                Previsualizar Inspector Forense
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Mobile tactile cards */}
          <div className="space-y-2.5 md:hidden">
            {filteredItems.map((entry) => {
              const tone = ACTION_TONES[entry.action] ?? "neutral";
              const iconName = ACTION_ICONS[entry.action] ?? "Description";

              return (
                <div
                  key={entry.id}
                  className="border-border bg-card space-y-2.5 border p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center">
                        <Icon name={iconName} className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-medium">
                          {entry.action}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          en {entry.entity}
                        </p>
                      </div>
                    </div>
                    <StatusPill tone={tone}>
                      {entry.action.split(".")[0] ?? "log"}
                    </StatusPill>
                  </div>

                  <div className="border-border flex items-center justify-between border-t pt-2 text-[11px]">
                    <span className="text-muted-foreground">
                      Por{" "}
                      <strong className="text-foreground font-medium">
                        {entry.actorName ?? "Sistema"}
                      </strong>
                    </span>
                    <time className="text-muted-foreground font-mono text-[10px] tabular-nums">
                      {new Date(entry.createdAt).toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedEntry(entry)}
                    className="h-8 w-full text-xs font-medium"
                  >
                    <Icons.Visibility className="mr-1.5 size-3.5" />
                    Ver Detalle Forense
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Desktop structured table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filteredItems}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onResetFilters={
                search || entityFilter
                  ? () => {
                      setSearch("");
                      setEntityFilter("");
                    }
                  : undefined
              }
              emptyTitle="No se encontraron registros de auditoría"
              emptyDescription={
                search || entityFilter
                  ? "No hay eventos que coincidan con los filtros aplicados."
                  : "El registro de auditoría no contiene eventos recientes en este entorno."
              }
            />
          </div>
        </>
      )}

      {/* Audit Details Modal */}
      <AuditDetailsDialog
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
      />
    </div>
  );
}
