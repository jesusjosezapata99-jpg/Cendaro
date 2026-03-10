"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

const ACTION_COLORS: Record<string, string> = {
  "user.create":
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-primary",
  "user.update":
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "price.update":
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "inventory.adjust":
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "container.close":
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "cash.close":
    "bg-slate-100 text-slate-700 dark:bg-secondary dark:text-muted-foreground",
};

export default function AuditPage() {
  const trpc = useTRPC();
  const [entityFilter, setEntityFilter] = useState("");
  const { data: entries, isLoading } = useQuery(
    trpc.audit.list.queryOptions({
      limit: 50,
      entity: entityFilter || undefined,
    }),
  );

  const items = entries ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Log de Auditoría
        </h1>
        <p className="text-muted-foreground">
          Registro inmutable de todas las acciones críticas del sistema
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border-border bg-card text-foreground rounded-lg border px-3 py-2 text-sm"
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
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="border-border bg-card rounded-xl border shadow-sm">
          <div className="divide-border divide-y">
            {items.map((entry) => (
              <div
                key={entry.id}
                className="hover:bg-muted/30 flex items-start gap-4 px-6 py-4 transition-colors"
              >
                <div
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-sm ${ACTION_COLORS[entry.action] ?? "bg-muted"}`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {ACTION_ICONS[entry.action] ?? "description"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-medium">
                      {entry.action} → {entry.entity}
                      {entry.entityId
                        ? ` (${entry.entityId.slice(0, 8)}…)`
                        : ""}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ACTION_COLORS[entry.action] ?? "bg-muted"}`}
                    >
                      {entry.action}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                    <span>por {entry.actorName ?? "Sistema"}</span>
                    <span>•</span>
                    <span>{entry.actorRole ?? "system"}</span>
                    <span>•</span>
                    <time>{new Date(entry.createdAt).toLocaleString()}</time>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !isLoading && (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            history
          </span>
          <p className="text-sm">No hay entradas de auditoría</p>
        </div>
      )}
    </div>
  );
}
