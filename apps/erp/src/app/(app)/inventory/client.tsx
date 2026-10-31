"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { IconName } from "@cendaro/ui/icons";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { ActiveFilterItem, FilterSection } from "~/components/data-table";
import { DataTable, DataTableFilterBar } from "~/components/data-table";
import { Field, Input, Select } from "~/components/dialog";
import { PageHeader } from "~/components/page-header";
import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
import { StatCard } from "~/components/stat-card";
import { useInventoryFilterParams } from "~/hooks/params/use-inventory-filter-params";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const TransferStockDialog = lazy(() =>
  import("~/components/forms/transfer-stock").then((m) => ({
    default: m.TransferStockDialog,
  })),
);
const CycleCountDialog = lazy(() =>
  import("~/components/forms/cycle-count").then((m) => ({
    default: m.CycleCountDialog,
  })),
);

/** Sales channels with system chart tokens */
const CHANNELS: { key: string; label: string; icon: IconName; tone: string }[] =
  [
    {
      key: "store",
      label: "Tienda",
      icon: "Store",
      tone: "bg-chart-1/15 text-chart-1",
    },
    {
      key: "mercadolibre",
      label: "Mercado Libre",
      icon: "ShoppingCart",
      tone: "bg-chart-2/15 text-chart-2",
    },
    {
      key: "vendors",
      label: "Vendedores",
      icon: "Group",
      tone: "bg-chart-3/15 text-chart-3",
    },
  ];

const VALID_STOCK_STATUSES = ["in_stock", "low_stock", "out_of_stock"] as const;
type ValidStockStatus = (typeof VALID_STOCK_STATUSES)[number];

const VALID_INVENTORY_SORTS = [
  "name:asc",
  "name:desc",
  "sku:asc",
  "sku:desc",
  "totalStock:asc",
  "totalStock:desc",
] as const;
type ValidInventorySort = (typeof VALID_INVENTORY_SORTS)[number];

interface StockItem {
  id: string;
  sku: string;
  name: string;
  status: string;
  totalStock: number;
  locked: boolean;
  storeStock: number;
  mlStock: number;
  vendorStock: number;
}

interface ChannelRow {
  channel: string;
  totalStock: string | number | null;
}

function getStockStatus(item: StockItem): ValidStockStatus {
  if (item.totalStock <= 0) return "out_of_stock";
  if (item.totalStock <= 5) return "low_stock";
  return "in_stock";
}

export default function InventoryClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [filters, setFilters] = useInventoryFilterParams();

  const [showTransfer, setShowTransfer] = useState(false);
  const [showCycle, setShowCycle] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [whForm, setWhForm] = useState<{
    name: string;
    type:
      | "warehouse"
      | "showroom"
      | "external"
      | "transit"
      | "reserved"
      | "defective";
    location: string;
  }>({
    name: "",
    type: "warehouse",
    location: "",
  });
  const [purchaseForm, setPurchaseForm] = useState({
    warehouseId: "",
    supplierId: "",
    invoiceNumber: "",
    productId: "",
    quantity: "1",
    unitCostUsd: "0",
    notes: "",
  });

  const createWarehouse = useMutation(
    trpc.inventory.createWarehouse.mutationOptions({
      onSuccess: () => {
        toast.success("Almacén creado exitosamente");
        setShowWarehouseModal(false);
        setWhForm({ name: "", type: "warehouse", location: "" });
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const receivePurchase = useMutation(
    trpc.inventory.receivePurchase.mutationOptions({
      onSuccess: (res) => {
        toast.success(
          `Compra recibida (${res.totalUnits} unidades actualizadas en inventario y tienda)`,
        );
        setShowPurchaseModal(false);
        setPurchaseForm({
          warehouseId: "",
          supplierId: "",
          invoiceNumber: "",
          productId: "",
          quantity: "1",
          unitCostUsd: "0",
          notes: "",
        });
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const finalizeCount = useMutation(
    trpc.inventory.finalizeCount.mutationOptions({
      onSuccess: () => {
        toast.success("Conteo físico finalizado");
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const approveCount = useMutation(
    trpc.inventory.approveCount.mutationOptions({
      onSuccess: () => {
        toast.success("Conteo físico aprobado y ajustes aplicados");
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const clearFilters = useCallback(() => {
    void setFilters({
      search: "",
      status: "all",
      statuses: [],
      warehouseId: "",
      sort: "",
    });
  }, [setFilters]);

  const toggleStatus = useCallback(
    (key: string) => {
      const current = filters.statuses;
      const next = current.includes(key)
        ? current.filter((s) => s !== key)
        : [...current, key];
      void setFilters({ statuses: next, status: "all" });
    },
    [filters.statuses, setFilters],
  );

  // Validated status filter
  const activeStatuses = useMemo<ValidStockStatus[] | undefined>(() => {
    const list = filters.statuses.filter((s): s is ValidStockStatus =>
      VALID_STOCK_STATUSES.includes(s as ValidStockStatus),
    );
    if (list.length > 0) return list;
    if (
      filters.status &&
      VALID_STOCK_STATUSES.includes(filters.status as ValidStockStatus)
    ) {
      return [filters.status as ValidStockStatus];
    }
    return undefined;
  }, [filters.statuses, filters.status]);

  const validSort = useMemo<ValidInventorySort | undefined>(() => {
    if (
      filters.sort &&
      VALID_INVENTORY_SORTS.includes(filters.sort as ValidInventorySort)
    ) {
      return filters.sort as ValidInventorySort;
    }
    return undefined;
  }, [filters.sort]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.inventory.stockOverview.infiniteQueryOptions(
      {
        limit: 50,
        search: filters.search || undefined,
        statuses: activeStatuses,
        sort: validSort,
      },
      {
        getNextPageParam: (lastPage, allPages) => {
          if (lastPage.length < 50) return undefined;
          return allPages.length * 50;
        },
      },
    ),
  );

  const items = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  );

  const { data: channelData } = useQuery(
    trpc.inventory.channelSummary.queryOptions(),
  );
  const { data: warehouses } = useQuery(
    trpc.inventory.listWarehouses.queryOptions(),
  );
  const { data: suppliers } = useQuery(
    trpc.catalog.listSuppliers.queryOptions(),
  );
  const { data: counts } = useQuery(trpc.inventory.listCounts.queryOptions());

  const channelStock = useMemo(
    () =>
      (channelData ??
        CHANNELS.map((ch) => ({
          channel: ch.key,
          totalStock: 0,
        }))) as ChannelRow[],
    [channelData],
  );

  const { totalStock, lowStockCount, outOfStockCount } = useMemo(() => {
    let ts = 0;
    let ls = 0;
    let os = 0;
    for (const it of items) {
      ts += it.totalStock;
      const status = getStockStatus(it);
      if (status === "low_stock") ls++;
      if (status === "out_of_stock") os++;
    }
    return { totalStock: ts, lowStockCount: ls, outOfStockCount: os };
  }, [items]);

  // Columns definition
  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        meta: {
          sticky: true,
          className:
            "w-36 font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.sku}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Producto",
        cell: ({ row }) => (
          <Link
            href={`/catalog/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground block max-w-md truncate font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const st = getStockStatus(row.original);
          const s = getStatus("stock", st);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        accessorKey: "totalStock",
        header: "Total",
        meta: {
          numeric: true,
          align: "right",
          className: "w-28 text-right font-mono font-medium tabular-nums",
        },
        cell: ({ row }) => (
          <span className="font-mono font-medium tabular-nums">
            {row.original.totalStock.toLocaleString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "storeStock",
        header: "Tienda",
        meta: {
          numeric: true,
          align: "right",
          className:
            "w-24 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.storeStock.toLocaleString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "mlStock",
        header: "ML",
        meta: {
          numeric: true,
          align: "right",
          className:
            "w-24 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.mlStock.toLocaleString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "vendorStock",
        header: "Vendedores",
        meta: {
          numeric: true,
          align: "right",
          className:
            "w-28 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.vendorStock.toLocaleString("es-VE")}
          </span>
        ),
      },
    ],
    [],
  );

  // Filter sections for popover
  const filterSections = useMemo<FilterSection[]>(
    () => [
      {
        id: "status",
        title: "Nivel de stock",
        options: VALID_STOCK_STATUSES.map((key) => ({
          value: key,
          label: getStatus("stock", key).label,
        })),
        selectedValues: activeStatuses ?? [],
        onToggle: toggleStatus,
      },
    ],
    [activeStatuses, toggleStatus],
  );

  // Active filter chips
  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const res: ActiveFilterItem[] = [];

    if (filters.search) {
      res.push({
        id: "search",
        label: "Búsqueda",
        valueLabel: filters.search,
        onRemove: () => void setFilters({ search: "" }),
      });
    }

    if (activeStatuses && activeStatuses.length > 0) {
      for (const s of activeStatuses) {
        res.push({
          id: `status-${s}`,
          label: "Estado",
          valueLabel: getStatus("stock", s).label,
          onRemove: () => toggleStatus(s),
        });
      }
    }

    return res;
  }, [filters.search, activeStatuses, setFilters, toggleStatus]);

  const activeFilterCount =
    (filters.search ? 1 : 0) + (activeStatuses?.length ?? 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Inventario"
        description="Control multicanal de existencias"
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowPurchaseModal(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.LocalShipping className="size-4.5" />
              Compra Nacional
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowWarehouseModal(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.Warehouse className="size-4.5" />
              Nuevo Almacén
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowTransfer(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.SwapHoriz className="size-4.5" />
              Transferir
            </Button>
            <Button
              onClick={() => setShowCycle(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.FactCheck className="size-4.5" />
              Conteo
            </Button>
          </div>
        }
      />

      <SheetModal
        open={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        title="Nuevo Almacén"
        description="Registra un almacén físico, en tránsito o virtual."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createWarehouse.mutate({
              name: whForm.name,
              type: whForm.type,
              location: whForm.location || undefined,
            });
          }}
          className="flex h-full flex-col"
        >
          <SheetBody>
            <Field label="Nombre del Almacén" required>
              <Input
                value={whForm.name}
                onChange={(e) =>
                  setWhForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Ej. Almacén Principal Boleíta"
                required
              />
            </Field>
            <Field label="Tipo" required>
              <Select
                value={whForm.type}
                onChange={(e) =>
                  setWhForm((prev) => ({
                    ...prev,
                    type: e.target.value as typeof prev.type,
                  }))
                }
              >
                <option value="warehouse">Almacén</option>
                <option value="showroom">Showroom</option>
                <option value="external">Externo</option>
                <option value="transit">En Tránsito</option>
                <option value="reserved">Reservado</option>
                <option value="defective">Defectuoso</option>
              </Select>
            </Field>
            <Field label="Ubicación">
              <Input
                value={whForm.location}
                onChange={(e) =>
                  setWhForm((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="Ej. Caracas, Miranda"
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <SheetFormActions
              onCancel={() => setShowWarehouseModal(false)}
              submitting={createWarehouse.isPending}
              submitLabel="Crear Almacén"
            />
          </SheetFooter>
        </form>
      </SheetModal>

      <SheetModal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        title="Recepción de Compra Nacional / Directa"
        description="Ingresa mercancía adquirida localmente sin contenedor marítimo. Recalcula el costo promedio ponderado y habilita stock en tienda."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const targetWh =
              (purchaseForm.warehouseId || warehouses?.[0]?.id) ?? "";
            const targetProd = (purchaseForm.productId || items[0]?.id) ?? "";
            if (!targetWh || !targetProd) {
              toast.error("Selecciona un almacén y un producto válidos");
              return;
            }
            receivePurchase.mutate({
              warehouseId: targetWh,
              supplierId: purchaseForm.supplierId || undefined,
              invoiceNumber: purchaseForm.invoiceNumber.trim() || "S/N",
              notes: purchaseForm.notes.trim() || undefined,
              items: [
                {
                  productId: targetProd,
                  quantity: Math.max(
                    1,
                    parseInt(purchaseForm.quantity, 10) || 1,
                  ),
                  unitCostUsd: Math.max(
                    0,
                    parseFloat(purchaseForm.unitCostUsd) || 0,
                  ),
                },
              ],
            });
          }}
          className="flex h-full flex-col"
        >
          <SheetBody>
            <Field label="Almacén de Destino" required>
              <Select
                id="purchase-warehouse-id"
                name="warehouseId"
                required
                value={(purchaseForm.warehouseId || warehouses?.[0]?.id) ?? ""}
                onChange={(e) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    warehouseId: e.target.value,
                  }))
                }
              >
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Proveedor (Opcional)">
              <Select
                id="purchase-supplier-id"
                name="supplierId"
                value={purchaseForm.supplierId}
                onChange={(e) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    supplierId: e.target.value,
                  }))
                }
              >
                <option value="">— Compra directa / Sin proveedor —</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.country})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="N° Factura / Nota de Entrega">
              <Input
                id="purchase-invoice-number"
                name="invoiceNumber"
                value={purchaseForm.invoiceNumber}
                onChange={(e) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    invoiceNumber: e.target.value,
                  }))
                }
                placeholder="Ej. FAC-0004821"
              />
            </Field>
            <Field label="Producto" required>
              <Select
                id="purchase-product-id"
                name="productId"
                required
                value={(purchaseForm.productId || items[0]?.id) ?? ""}
                onChange={(e) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    productId: e.target.value,
                  }))
                }
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} — {it.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad Recibida" required>
                <Input
                  id="purchase-quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={purchaseForm.quantity}
                  onChange={(e) =>
                    setPurchaseForm((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                  className="font-mono tabular-nums"
                />
              </Field>
              <Field
                label="Costo Unitario ($ USD)"
                required
                hint="Actualiza costo promedio"
              >
                <Input
                  id="purchase-unit-cost"
                  name="unitCostUsd"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={purchaseForm.unitCostUsd}
                  onChange={(e) =>
                    setPurchaseForm((prev) => ({
                      ...prev,
                      unitCostUsd: e.target.value,
                    }))
                  }
                  className="font-mono tabular-nums"
                />
              </Field>
            </div>
            <Field label="Observaciones">
              <Input
                id="purchase-notes"
                name="notes"
                value={purchaseForm.notes}
                onChange={(e) =>
                  setPurchaseForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Detalle de recepción o lote..."
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <SheetFormActions
              onCancel={() => setShowPurchaseModal(false)}
              submitting={receivePurchase.isPending}
              submitLabel="Registrar Compra"
            />
          </SheetFooter>
        </form>
      </SheetModal>

      <Suspense>
        <TransferStockDialog
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
        />
        <CycleCountDialog
          open={showCycle}
          onClose={() => setShowCycle(false)}
        />
      </Suspense>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Stock Total"
          value={isLoading ? "—" : totalStock.toLocaleString("es-VE")}
          icon="Inventory2"
          tone="primary"
        />
        <StatCard
          label="Productos"
          value={isLoading ? "—" : items.length.toLocaleString("es-VE")}
          icon="Category"
        />
        <StatCard
          label="Bajo Stock"
          value={isLoading ? "—" : lowStockCount.toLocaleString("es-VE")}
          icon="TrendingDown"
          tone="warning"
        />
        <StatCard
          label="Sin Stock"
          value={isLoading ? "—" : outOfStockCount.toLocaleString("es-VE")}
          icon="Error"
          tone="destructive"
        />
      </div>

      {/* Channel Stock Breakdown (Monochrome Style) */}
      <div className="mobile-scroll-x flex gap-3 pb-1">
        {CHANNELS.map((ch) => {
          const chData = channelStock.find(
            (cs: ChannelRow) => cs.channel === ch.key,
          );
          const val = Number(chData?.totalStock ?? 0);
          return (
            <div
              key={ch.key}
              className="border-border bg-background flex min-w-40 shrink-0 items-center gap-3 border p-4"
            >
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center ${ch.tone}`}
              >
                <Icon name={ch.icon} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {ch.label}
                </p>
                <p className="text-foreground font-mono text-lg font-medium tabular-nums">
                  {val.toLocaleString("es-VE")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warehouses (Monochrome Style) */}
      {warehouses && warehouses.length > 0 && (
        <div className="mobile-scroll-x flex gap-3 pb-1">
          {warehouses.map((w) => (
            <Link
              key={w.id}
              href={`/inventory/warehouse/${w.id}`}
              className="border-border bg-background hover:border-foreground/30 flex min-w-48 shrink-0 items-center gap-3 border p-4 transition-colors"
            >
              <span className="bg-secondary text-muted-foreground flex size-10 shrink-0 items-center justify-center">
                <Icons.Warehouse className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {w.name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {w.location ?? "Principal"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Cycle Counts Section */}
      {counts && counts.length > 0 && (
        <div className="border-border bg-background space-y-3 border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-sm font-medium tracking-wider uppercase">
              Conteos Físicos Recientes
            </h2>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {counts.length} registros
            </span>
          </div>
          <div className="divide-border divide-y">
            {counts.slice(0, 5).map((c) => {
              const whName =
                warehouses?.find((w) => w.id === c.warehouseId)?.name ??
                "Almacén";
              const countStatus = getStatus("inventoryCount", c.status);
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <StatusPill tone={countStatus.tone}>
                      {countStatus.label}
                    </StatusPill>
                    <span className="text-foreground text-sm font-medium">
                      {whName}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {new Date(c.createdAt).toLocaleDateString("es-VE")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(c.status === "draft" || c.status === "in_progress") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={finalizeCount.isPending}
                        onClick={() => finalizeCount.mutate({ countId: c.id })}
                      >
                        Finalizar Conteo
                      </Button>
                    )}
                    {c.status === "completed" && (
                      <Button
                        size="sm"
                        disabled={approveCount.isPending}
                        onClick={() => approveCount.mutate({ id: c.id })}
                      >
                        Aprobar Ajustes
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <DataTableFilterBar
        search={{
          value: filters.search,
          onChange: (val) => void setFilters({ search: val }),
          placeholder: "Buscar producto por nombre o SKU...",
        }}
        popover={{
          sections: filterSections,
          activeCount: activeFilterCount,
          onClearAll: clearFilters,
        }}
        activeFilters={activeFilters}
        onClearAllFilters={clearFilters}
      />

      {/* Virtualized Data Table */}
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        sort={filters.sort}
        onSortChange={(newSort) => void setFilters({ sort: newSort ?? "" })}
        onRowClick={(item) => router.push(`/catalog/${item.id}`)}
        onResetFilters={clearFilters}
        emptyTitle="No se encontraron items en inventario"
        emptyDescription="Ajusta la búsqueda o el filtro de nivel de stock."
      />
    </div>
  );
}
