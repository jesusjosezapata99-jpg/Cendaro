"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { ActiveFilterItem, FilterSection } from "~/components/data-table";
import { DataTable, DataTableFilterBar } from "~/components/data-table";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useProductParams } from "~/hooks/params";
import { useProductFilterParams } from "~/hooks/params/use-product-filter-params";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const VALID_PRODUCT_STATUSES = ["active", "draft", "discontinued"] as const;
type ValidProductStatus = (typeof VALID_PRODUCT_STATUSES)[number];

const VALID_CATALOG_SORTS = [
  "createdAt:asc",
  "createdAt:desc",
  "name:asc",
  "name:desc",
  "sku:asc",
  "sku:desc",
] as const;
type ValidCatalogSort = (typeof VALID_CATALOG_SORTS)[number];

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  imageUrl: string | null;
  status: string;
  brandId: string | null;
  categoryId: string | null;
  supplierId: string | null;
  createdAt: Date | string;
}

export default function CatalogClient() {
  const trpc = useTRPC();
  const [filters, setFilters] = useProductFilterParams();
  const [, setProductParams] = useProductParams();

  const clearFilters = useCallback(() => {
    void setFilters({
      search: "",
      status: "all",
      statuses: [],
      brandId: "all",
      brandIds: [],
      categoryId: "all",
      categoryIds: [],
      supplierId: "all",
      supplierIds: [],
      sort: "",
      page: 0,
    });
  }, [setFilters]);

  const toggleStatus = useCallback(
    (key: string) => {
      const current = filters.statuses;
      const next = current.includes(key)
        ? current.filter((s) => s !== key)
        : [...current, key];
      void setFilters({ statuses: next, status: "all", page: 0 });
    },
    [filters.statuses, setFilters],
  );

  // Validated status filter
  const activeStatuses = useMemo<ValidProductStatus[] | undefined>(() => {
    const list = filters.statuses.filter((s): s is ValidProductStatus =>
      VALID_PRODUCT_STATUSES.includes(s as ValidProductStatus),
    );
    if (list.length > 0) return list;
    if (
      filters.status &&
      VALID_PRODUCT_STATUSES.includes(filters.status as ValidProductStatus)
    ) {
      return [filters.status as ValidProductStatus];
    }
    return undefined;
  }, [filters.statuses, filters.status]);

  const validSort = useMemo<ValidCatalogSort | undefined>(() => {
    if (
      filters.sort &&
      VALID_CATALOG_SORTS.includes(filters.sort as ValidCatalogSort)
    ) {
      return filters.sort as ValidCatalogSort;
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
    trpc.catalog.listProducts.infiniteQueryOptions(
      {
        limit: 50,
        search: filters.search || undefined,
        statuses: activeStatuses,
        brandIds: filters.brandIds.length > 0 ? filters.brandIds : undefined,
        categoryIds:
          filters.categoryIds.length > 0 ? filters.categoryIds : undefined,
        supplierIds:
          filters.supplierIds.length > 0 ? filters.supplierIds : undefined,
        sort: validSort,
      },
      {
        getNextPageParam: (lastPage, allPages) => {
          const totalFetched = allPages.reduce(
            (acc, p) => acc + p.items.length,
            0,
          );
          if (totalFetched >= lastPage.total || lastPage.items.length < 50) {
            return undefined;
          }
          return totalFetched;
        },
      },
    ),
  );

  const products = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data?.pages],
  );

  const total = data?.pages[0]?.total ?? 0;

  // Columns definition
  const columns = useMemo<ColumnDef<ProductItem>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "Referencia",
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
          const s = getStatus("product", row.original.status);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "Creado",
        meta: {
          align: "right",
          className:
            "w-36 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE")}
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
        title: "Estado del producto",
        options: VALID_PRODUCT_STATUSES.map((key) => ({
          value: key,
          label: getStatus("product", key).label,
        })),
        selectedValues: activeStatuses ?? [],
        onToggle: toggleStatus,
      },
    ],
    [activeStatuses, toggleStatus],
  );

  // Active filter chips
  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];

    if (filters.search) {
      items.push({
        id: "search",
        label: "Búsqueda",
        valueLabel: filters.search,
        onRemove: () => void setFilters({ search: "", page: 0 }),
      });
    }

    if (activeStatuses && activeStatuses.length > 0) {
      for (const s of activeStatuses) {
        items.push({
          id: `status-${s}`,
          label: "Estado",
          valueLabel: getStatus("product", s).label,
          onRemove: () => toggleStatus(s),
        });
      }
    }

    return items;
  }, [filters.search, activeStatuses, setFilters, toggleStatus]);

  const activeFilterCount =
    (filters.search ? 1 : 0) + (activeStatuses?.length ?? 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Catálogo de Productos"
        description={`Gestiona tu catálogo de ${total.toLocaleString("es-VE")} referencias`}
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" asChild className="min-h-11">
              <Link href="/catalog/import">
                <Icons.UploadFile className="size-4.5" />
                Importar
              </Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/catalog?createProduct=true">
                <Icons.Add className="size-4.5" />
                Nuevo Producto
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Productos"
          value={isLoading ? "—" : total.toLocaleString("es-VE")}
          icon="Inventory2"
          tone="primary"
        />
        <StatCard
          label="Mostrando"
          value={isLoading ? "—" : products.length.toLocaleString("es-VE")}
          icon="Visibility"
          tone="success"
        />
      </div>

      {/* Filter Bar */}
      <DataTableFilterBar
        search={{
          value: filters.search,
          onChange: (val) => void setFilters({ search: val, page: 0 }),
          placeholder: "Buscar por nombre, SKU o código de barras...",
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
        data={products}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        sort={filters.sort}
        onSortChange={(newSort) =>
          void setFilters({ sort: newSort ?? "", page: 0 })
        }
        onRowClick={(product) =>
          void setProductParams({ productId: product.id })
        }
        onResetFilters={clearFilters}
        emptyTitle="No se encontraron productos"
        emptyDescription="Ajusta la búsqueda o el filtro de estado e inténtalo de nuevo."
      />
    </div>
  );
}
