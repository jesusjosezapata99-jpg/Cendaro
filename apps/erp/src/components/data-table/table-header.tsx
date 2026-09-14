"use client";

import { flexRender } from "@tanstack/react-table";

import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { DataTableHeaderProps } from "./types";

export function DataTableHeader<TData>({
  table,
  currentSort,
  onSortToggle,
}: DataTableHeaderProps<TData>) {
  return (
    <div
      data-slot="data-table-header"
      className="border-border bg-background text-muted-foreground sticky top-0 z-20 flex h-11.25 w-full border-b text-xs font-normal select-none"
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <div key={headerGroup.id} className="flex w-full items-center">
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta;
            const canSort = header.column.getCanSort();
            const columnId = header.column.id;
            const isSorted = currentSort?.column === columnId;
            const sortDirection = isSorted ? currentSort.direction : null;

            const isStickyLeft =
              meta?.sticky === true || meta?.sticky === "left";

            return (
              <div
                key={header.id}
                style={{
                  width:
                    header.getSize() !== 150
                      ? `${header.getSize()}px`
                      : undefined,
                  flex: header.getSize() !== 150 ? "none" : 1,
                }}
                className={cn(
                  "flex h-full items-center px-4 py-3 text-xs font-normal transition-colors",
                  meta?.numeric
                    ? "justify-end text-right"
                    : "justify-start text-left",
                  isStickyLeft &&
                    "bg-background sticky left-0 z-30 shadow-[1px_0_0_0_var(--border)]",
                  meta?.headerClassName,
                  meta?.className,
                )}
              >
                {header.isPlaceholder ? null : canSort && onSortToggle ? (
                  <button
                    type="button"
                    onClick={() => onSortToggle(columnId)}
                    className={cn(
                      "group/btn hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 transition-colors focus-visible:ring-1 focus-visible:outline-none",
                      meta?.numeric && "flex-row-reverse",
                      isSorted && "text-foreground font-medium",
                    )}
                    aria-label={`Ordenar por ${header.column.id}`}
                    aria-sort={
                      sortDirection === "asc"
                        ? "ascending"
                        : sortDirection === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <span>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </span>
                    {sortDirection === "asc" ? (
                      <Icons.ArrowUpward className="text-foreground size-3.5 shrink-0" />
                    ) : sortDirection === "desc" ? (
                      <Icons.ArrowDownward className="text-foreground size-3.5 shrink-0" />
                    ) : (
                      <Icons.ArrowDownward className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/btn:opacity-40" />
                    )}
                  </button>
                ) : (
                  <span>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
