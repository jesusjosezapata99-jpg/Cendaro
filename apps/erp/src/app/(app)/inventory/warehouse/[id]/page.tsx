"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "~/trpc/client";

/* ── Reusable primitives ──────────────────────── */

const badgeColors: Record<string, string> = {
  physical: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  transit:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  virtual:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800",
  discontinued: "bg-red-100 text-red-700 dark:bg-red-900/30",
};

const inputBase =
  "w-full min-h-[36px] rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20";

/* ── Component ────────────────────────────────── */

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  /* Data */
  const { data: warehouse, isLoading: loadingWarehouse } = useQuery(
    trpc.inventory.getWarehouseDetail.queryOptions({ id }),
  );

  const { data: stock, isLoading: loadingStock } = useQuery(
    trpc.inventory.warehouseStock.queryOptions({
      warehouseId: id,
      search: search || undefined,
    }),
  );

  /* Mutations */
  const updateQty = useMutation(
    trpc.inventory.updateStockQuantity.mutationOptions({
      onSuccess: () => {
        toast.success("Stock actualizado correctamente");
        setEditingId(null);
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
      },
    }),
  );

  /* Handlers */
  const startEdit = (stockId: string, currentQty: number) => {
    setEditingId(stockId);
    setEditQty(String(currentQty));
  };

  const submitEdit = (stockId: string) => {
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 0) return;
    updateQty.mutate({ stockLedgerId: stockId, newQuantity: qty });
  };

  /* Loading */
  if (loadingWarehouse) {
    return (
      <div className="space-y-6 p-4 lg:p-8">
        <div className="bg-muted h-6 w-48 animate-pulse rounded" />
        <div className="bg-muted h-10 w-80 animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <span className="material-symbols-outlined text-muted-foreground text-5xl">
          warehouse
        </span>
        <p className="text-muted-foreground text-lg">Almacén no encontrado</p>
        <Link
          href="/inventory"
          className="text-primary text-sm font-medium hover:underline"
        >
          ← Volver a Inventario
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/inventory"
          className="hover:text-foreground transition-colors"
        >
          Inventario
        </Link>
        <span className="material-symbols-outlined text-base">
          chevron_right
        </span>
        <span className="text-foreground font-medium">{warehouse.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-2xl font-black tracking-tight">
              {warehouse.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColors[warehouse.type] ?? "bg-gray-100 text-gray-700"}`}
            >
              {warehouse.type}
            </span>
            {!warehouse.isActive && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30">
                Inactivo
              </span>
            )}
          </div>
          {warehouse.location && (
            <p className="text-muted-foreground mt-1 text-sm">
              <span className="material-symbols-outlined mr-1 align-middle text-sm">
                location_on
              </span>
              {warehouse.location}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Productos",
            value: warehouse.totalProducts,
            icon: "inventory_2",
            color: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Stock Total",
            value: warehouse.totalStock.toLocaleString(),
            icon: "stacks",
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Stock Bajo (≤5)",
            value: warehouse.lowStockCount,
            icon: "warning",
            color: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "Bloqueados",
            value: warehouse.lockedCount,
            icon: "lock",
            color: "text-red-600 dark:text-red-400",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="border-border bg-card rounded-xl border p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className={`material-symbols-outlined text-xl ${kpi.color}`}
              >
                {kpi.icon}
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                {kpi.label}
              </span>
            </div>
            <p className="text-foreground mt-2 text-2xl font-black">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="material-symbols-outlined text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-lg">
          search
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o SKU..."
          className={`${inputBase} pl-10`}
        />
      </div>

      {/* Stock Table */}
      <section className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b text-left">
                <th className="text-muted-foreground px-4 py-3 font-semibold">
                  Producto
                </th>
                <th className="text-muted-foreground px-4 py-3 font-semibold">
                  SKU
                </th>
                <th className="text-muted-foreground px-4 py-3 text-center font-semibold">
                  Estado
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right font-semibold">
                  Cantidad
                </th>
                <th className="text-muted-foreground px-4 py-3 text-center font-semibold">
                  Bloqueado
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right font-semibold">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingStock ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="bg-muted h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !stock?.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-4 py-8 text-center"
                  >
                    No hay productos en este almacén
                  </td>
                </tr>
              ) : (
                stock.map((item) => (
                  <tr
                    key={item.id}
                    className="border-border hover:bg-muted/30 border-b transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/catalog/${item.productId}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {item.productName}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {item.productSku}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[item.productStatus] ?? ""}`}
                      >
                        {item.productStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min={0}
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            autoFocus
                            className="w-20 rounded border px-2 py-1 text-right text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitEdit(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <button
                            onClick={() => submitEdit(item.id)}
                            disabled={updateQty.isPending}
                            className="text-primary hover:text-primary/80"
                          >
                            <span className="material-symbols-outlined text-lg">
                              check
                            </span>
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <span className="material-symbols-outlined text-lg">
                              close
                            </span>
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`font-bold ${item.quantity <= 5 && item.quantity > 0 ? "text-amber-600 dark:text-amber-400" : item.quantity === 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
                        >
                          {item.quantity.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.isLocked ? (
                        <span className="material-symbols-outlined text-lg text-red-500">
                          lock
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-muted-foreground text-lg">
                          lock_open
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId !== item.id && (
                        <button
                          onClick={() => startEdit(item.id, item.quantity)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar cantidad"
                        >
                          <span className="material-symbols-outlined text-lg">
                            edit
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
