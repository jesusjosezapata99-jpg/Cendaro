"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AuditEntry } from "~/components/modals/audit-details-dialog";
import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { AuditDetailsDialog } from "~/components/modals/audit-details-dialog";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const ACTION_ICONS: Record<string, string> = {
  "user.create": "person_add",
  "user.update": "edit",
  "price.update": "attach_money",
  "inventory.adjust": "package_2",
  "container.close": "local_shipping",
  "cash.close": "lock",
  "rate.update": "trending_up",
  "stock.transfer": "swap_horiz",
  "stock.lock": "lock",
  "stock.unlock": "lock_open",
  "repricing.approve": "check_circle",
  "payment.create": "payments",
  "payment.validate": "verified",
  "commission.pay": "attach_money",
  "count.create": "assignment",
  "count.approve": "task_alt",
  "warehouse.create": "warehouse",
  "ar.create": "receipt_long",
  "ar.payment": "paid",
  "ml.sync": "sync",
  "ml.import_order": "inbox",
  "integration.resolve": "check",
};

const ACTION_TONES: Record<string, StatusTone> = {
  "user.create": "primary",
  "user.update": "warning",
  "price.update": "success",
  "inventory.adjust": "warning",
  "container.close": "primary",
  "cash.close": "neutral",
  "rate.update": "primary",
  "stock.transfer": "neutral",
  "stock.lock": "warning",
  "stock.unlock": "success",
  "repricing.approve": "success",
  "payment.create": "primary",
  "payment.validate": "success",
  "commission.pay": "success",
  "count.create": "neutral",
  "count.approve": "success",
  "warehouse.create": "primary",
  "ar.create": "warning",
  "ar.payment": "success",
  "ml.sync": "primary",
  "ml.import_order": "primary",
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

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <PageHeader
        title="Log de Auditoría & Gobernanza"
        description="Trazabilidad forense inmutable de todas las mutaciones y eventos operacionales del ERP"
        actions={
          <div className="flex items-center gap-2">
            <button
              id="btn-inspect-model"
              type="button"
              onClick={() => setSelectedEntry(SAMPLE_AUDIT_ENTRY)}
              className="border-border bg-card text-foreground hover:bg-accent flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-sm">preview</span>
              Modelo Inspector
            </button>
            <button
              type="button"
              onClick={() => void refetch()}
              className="border-border bg-secondary text-foreground hover:bg-accent flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Actualizar
            </button>
          </div>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Eventos Registrados"
          value={isLoading ? "—" : items.length}
          icon="history"
          tone="default"
          sub="Últimos 100 logs"
        />
        <StatCard
          label="Entidades Auditadas"
          value={isLoading ? "—" : uniqueEntities}
          icon="database"
          tone="primary"
          sub="Tablas & recursos"
        />
        <StatCard
          label="Actores Únicos"
          value={isLoading ? "—" : uniqueActors}
          icon="group"
          tone="default"
          sub="Usuarios y procesos"
        />
        <StatCard
          label="Eventos Críticos"
          value={isLoading ? "—" : criticalEventsCount}
          icon="shield"
          tone={criticalEventsCount > 0 ? "warning" : "success"}
          sub="Aprobaciones & cierres"
        />
      </div>

      {/* Filters & Search */}
      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <span className="material-symbols-outlined text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por actor, acción, entidad o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-background placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border py-2 pr-3 pl-9 text-xs focus:ring-2 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border-border bg-background text-foreground focus:ring-primary/20 rounded-lg border px-3 py-2 text-xs focus:ring-2 focus:outline-none"
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
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon="history"
            title="No se encontraron registros de auditoría"
            description={
              search || entityFilter
                ? "No hay eventos que coincidan con los filtros aplicados."
                : "El registro de auditoría no contiene eventos recientes en este entorno."
            }
            action={
              <button
                type="button"
                onClick={() => setSelectedEntry(SAMPLE_AUDIT_ENTRY)}
                className="border-border bg-secondary text-foreground hover:bg-accent inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-sm">
                  visibility
                </span>
                Previsualizar Inspector Forense
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* Mobile tactile cards */}
          <div className="space-y-2.5 md:hidden">
            {filteredItems.map((entry) => {
              const tone = ACTION_TONES[entry.action] ?? "neutral";
              const iconName = ACTION_ICONS[entry.action] ?? "description";

              return (
                <div key={entry.id} className="surface-card space-y-2.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <span className="material-symbols-outlined text-sm">
                          {iconName}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-semibold">
                          {entry.action}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          en {entry.entity}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={tone}>
                      {entry.action.split(".")[0] ?? "log"}
                    </StatusBadge>
                  </div>

                  <div className="border-border/50 flex items-center justify-between border-t pt-2 text-[11px]">
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

                  <button
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className="border-border bg-secondary text-foreground hover:bg-accent flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      visibility
                    </span>
                    Ver Detalle Forense
                  </button>
                </div>
              );
            })}
          </div>

          {/* Desktop structured table */}
          <div className="surface-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-[10px] font-bold tracking-wider uppercase">
                    <th className="px-5 py-3.5">Fecha y Hora</th>
                    <th className="px-5 py-3.5">Acción</th>
                    <th className="px-5 py-3.5">Entidad Afectada</th>
                    <th className="px-5 py-3.5">Actor / Rol</th>
                    <th className="px-5 py-3.5 text-right">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filteredItems.map((entry) => {
                    const tone = ACTION_TONES[entry.action] ?? "neutral";
                    const iconName =
                      ACTION_ICONS[entry.action] ?? "description";

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <time className="text-foreground font-mono tabular-nums">
                            {new Date(entry.createdAt).toLocaleString("es-VE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </time>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded">
                              <span className="material-symbols-outlined text-xs">
                                {iconName}
                              </span>
                            </span>
                            <StatusBadge tone={tone}>
                              {entry.action}
                            </StatusBadge>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground font-medium">
                              {entry.entity}
                            </span>
                            {entry.entityId ? (
                              <span className="text-muted-foreground max-w-30 truncate font-mono text-[11px]">
                                ({entry.entityId.slice(0, 8)}…)
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-medium">
                              {entry.actorName ?? "Sistema"}
                            </span>
                            {entry.actorRole ? (
                              <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                                {entry.actorRole}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedEntry(entry)}
                            className="text-primary hover:bg-primary/10 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">
                              visibility
                            </span>
                            Inspeccionar
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

      {/* Audit Details Modal */}
      <AuditDetailsDialog
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
      />
    </div>
  );
}
