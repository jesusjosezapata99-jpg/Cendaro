"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { flexRender } from "@tanstack/react-table";

import { cn } from "@cendaro/ui";

import type { VirtualRowProps } from "./types";

export function VirtualRow<TData>({
  row,
  style,
  onRowClick,
  getRowHref,
  isSelected,
}: VirtualRowProps<TData>) {
  const router = useRouter();
  const href = getRowHref ? getRowHref(row.original) : undefined;
  const isClickable = Boolean(onRowClick ?? href);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't navigate if clicking an interactive element (checkbox, button, anchor, menu item)
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("button") ||
        target?.closest("input") ||
        target?.closest("a") ||
        target?.closest("[data-slot='checkbox']") ||
        target?.closest("[role='menuitem']")
      ) {
        return;
      }

      if (onRowClick) {
        onRowClick(row.original);
      } else if (href) {
        router.push(href);
      }
    },
    [href, onRowClick, router, row.original],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        const target = e.target as HTMLElement | null;
        if (
          target?.closest("button") ||
          target?.closest("input") ||
          target?.closest("a")
        ) {
          return;
        }

        e.preventDefault();
        if (onRowClick) {
          onRowClick(row.original);
        } else if (href) {
          router.push(href);
        }
      }
    },
    [href, onRowClick, router, row.original],
  );

  return (
    <div
      role={isClickable ? "button" : "row"}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      style={{
        ...style,
        contain: "layout style paint",
      }}
      data-slot="data-table-row"
      data-selected={isSelected}
      className={cn(
        "group/row border-border flex h-11.25 w-full items-center border-b text-sm transition-colors duration-75",
        "hover:bg-row-hover",
        isSelected && "bg-accent/40",
        isClickable &&
          "focus-visible:bg-row-hover cursor-pointer focus-visible:outline-none",
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta;
        const isStickyLeft = meta?.sticky === true || meta?.sticky === "left";

        return (
          <div
            key={cell.id}
            style={{
              width:
                cell.column.getSize() !== 150
                  ? `${cell.column.getSize()}px`
                  : undefined,
              flex: cell.column.getSize() !== 150 ? "none" : 1,
            }}
            className={cn(
              "flex h-full items-center truncate px-4 py-3 text-sm",
              meta?.numeric
                ? "justify-end text-right font-mono tabular-nums"
                : "justify-start text-left",
              isStickyLeft &&
                "bg-background group-hover/row:bg-row-hover sticky left-0 z-10 shadow-[1px_0_0_0_var(--border)]",
              meta?.className,
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}
    </div>
  );
}
