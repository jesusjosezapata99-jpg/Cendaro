"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn, Skeleton } from "@cendaro/ui";

interface DataTableSkeletonProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  rowCount?: number;
}

export function SkeletonCell({
  type = "text",
  numeric = false,
}: {
  type?: "text" | "badge" | "avatar-text" | "icon" | "number";
  numeric?: boolean;
}) {
  if (type === "badge") {
    return <Skeleton className="h-5 w-16 rounded-none" />;
  }

  if (type === "avatar-text") {
    return (
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (type === "icon") {
    return <Skeleton className="size-4 shrink-0 rounded-[2px]" />;
  }

  if (type === "number" || numeric) {
    return <Skeleton className="ml-auto h-4 w-16" />;
  }

  return <Skeleton className="h-4 w-28" />;
}

export function DataTableSkeleton<TData>({
  columns,
  rowCount = 10,
}: DataTableSkeletonProps<TData>) {
  return (
    <div
      data-slot="data-table-skeleton"
      className="border-border divide-border w-full divide-y"
    >
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="border-border flex h-11.25 w-full items-center border-b px-0"
        >
          {columns.map((column, colIndex) => {
            const meta = column.meta;
            const size = column.size !== 150 ? column.size : undefined;

            return (
              <div
                key={colIndex}
                style={{
                  width: size ? `${size}px` : undefined,
                  flex: size ? "none" : 1,
                }}
                className={cn(
                  "flex h-full items-center px-4 py-3",
                  meta?.numeric ? "justify-end" : "justify-start",
                  meta?.headerClassName,
                  meta?.className,
                )}
              >
                <SkeletonCell type={meta?.skeleton} numeric={meta?.numeric} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
