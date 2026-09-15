"use client";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { pluralize } from "~/lib/plural";

interface DataTableBottomBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  children?: React.ReactNode;
}

export function DataTableBottomBar({
  selectedCount,
  onClearSelection,
  children,
}: DataTableBottomBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      data-slot="data-table-bottom-bar"
      className="border-border bg-background/95 text-foreground animate-in fade-in slide-in-from-bottom-4 fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 border px-4 py-2.5 shadow-md backdrop-blur-md duration-150"
    >
      <div className="border-border flex items-center gap-2 border-r pr-3">
        <span className="font-mono text-xs font-medium tabular-nums">
          {selectedCount}
        </span>
        <span className="text-muted-foreground text-xs">
          {pluralize(selectedCount, "seleccionado", "seleccionados")}
        </span>
      </div>

      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
        title="Deseleccionar todos"
      >
        <Icons.Close className="mr-1 size-3.5" />
        Deseleccionar
      </Button>
    </div>
  );
}
