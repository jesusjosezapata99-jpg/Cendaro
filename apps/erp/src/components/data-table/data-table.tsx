"use client";

import type { RowSelectionState } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@cendaro/ui";

import type { DataTableProps, ParsedSort } from "./types";
import { DataTableBottomBar } from "./bottom-bar";
import { DataTableEmptyState, DataTableErrorState } from "./empty-states";
import { DataTableSkeleton } from "./skeleton";
import { DataTableHeader } from "./table-header";
import { formatSortParam, parseSortParam } from "./types";
import { VirtualRow } from "./virtual-row";

const ROW_HEIGHT = 45;

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  fetchNextPage,
  sort,
  onSortChange,
  onRowClick,
  getRowHref,
  enableRowSelection = false,
  rowSelection: externalRowSelection,
  onRowSelectionChange: externalOnRowSelectionChange,
  getRowId,
  emptyTitle,
  emptyDescription,
  onResetFilters,
  renderCustomEmpty,
  isError = false,
  onRetry,
  errorTitle,
  errorDescription,
  renderBottomBar,
  className,
  containerClassName,
  virtualizeThreshold = 50,
}: DataTableProps<TData>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Internal selection state if not controlled externally
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});

  const rowSelection = externalRowSelection ?? internalRowSelection;
  const setRowSelection =
    externalOnRowSelectionChange ?? setInternalRowSelection;

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    getRowId: getRowId ?? ((_, index) => String(index)),
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isVirtualized = rows.length >= virtualizeThreshold;

  // Virtualizer for smooth 60fps scrolling
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: isVirtualized,
  });

  // Current parsed sort state
  const currentSort: ParsedSort | null = useMemo(
    () => parseSortParam(sort),
    [sort],
  );

  // Sort toggle handler: none -> asc -> desc -> none
  const handleSortToggle = useCallback(
    (columnId: string) => {
      if (!onSortChange) return;

      if (currentSort?.column !== columnId) {
        onSortChange(formatSortParam(columnId, "asc"));
      } else if (currentSort.direction === "asc") {
        onSortChange(formatSortParam(columnId, "desc"));
      } else {
        onSortChange(undefined);
      }
    },
    [currentSort, onSortChange],
  );

  // Infinite scroll sentinel observer
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !fetchNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "250px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Selected rows
  const selectedRows = useMemo(() => {
    if (!enableRowSelection) return [];
    return table.getSelectedRowModel().rows.map((r) => r.original);
  }, [enableRowSelection, table]);

  const clearSelection = useCallback(() => {
    table.resetRowSelection();
  }, [table]);

  return (
    <div
      data-slot="data-table"
      className={cn("relative flex w-full flex-col", containerClassName)}
    >
      <div
        ref={scrollContainerRef}
        className={cn(
          "border-border relative max-h-[calc(100vh-280px)] min-h-90 w-full overflow-auto border",
          className,
        )}
      >
        {/* Sticky Table Header */}
        <DataTableHeader
          table={table}
          currentSort={currentSort}
          onSortToggle={onSortChange ? handleSortToggle : undefined}
        />

        {/* Loading Initial Page Skeleton */}
        {isLoading && data.length === 0 ? (
          <DataTableSkeleton columns={columns} />
        ) : null}

        {/* Error State (T8.10 C4) */}
        {!isLoading && isError ? (
          <DataTableErrorState
            title={errorTitle}
            description={errorDescription}
            onRetry={onRetry}
          />
        ) : null}

        {/* Empty State */}
        {!isLoading && !isError && data.length === 0 ? (
          renderCustomEmpty ? (
            renderCustomEmpty()
          ) : (
            <DataTableEmptyState
              title={emptyTitle}
              description={emptyDescription}
              onResetFilters={onResetFilters}
            />
          )
        ) : null}

        {/* Virtualized Rows */}
        {!isLoading && !isError && data.length > 0 && isVirtualized ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <VirtualRow
                  key={row.id}
                  row={row}
                  isSelected={row.getIsSelected()}
                  onRowClick={onRowClick}
                  getRowHref={getRowHref}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                />
              );
            })}
          </div>
        ) : null}

        {/* Standard Flow Rows (< 50 items) */}
        {!isLoading && !isError && data.length > 0 && !isVirtualized ? (
          <div className="w-full">
            {rows.map((row) => (
              <VirtualRow
                key={row.id}
                row={row}
                isSelected={row.getIsSelected()}
                onRowClick={onRowClick}
                getRowHref={getRowHref}
              />
            ))}
          </div>
        ) : null}

        {/* Loading more rows during infinite scroll */}
        {isFetchingNextPage ? (
          <DataTableSkeleton columns={columns} rowCount={3} />
        ) : null}

        {/* Sentinel element for infinite scroll */}
        {hasNextPage ? (
          <div
            ref={sentinelRef}
            className="pointer-events-none h-4 w-full opacity-0"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {/* Floating Selection Bottom Bar */}
      {enableRowSelection && selectedRows.length > 0 ? (
        renderBottomBar ? (
          renderBottomBar(selectedRows, clearSelection)
        ) : (
          <DataTableBottomBar
            selectedCount={selectedRows.length}
            onClearSelection={clearSelection}
          />
        )
      ) : null}
    </div>
  );
}
