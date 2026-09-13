"use client";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

interface OpenSearchButtonProps {
  onOpen: () => void;
}

/**
 * Dormant search trigger — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1 header spec,
 * M-20 (kbd hint fades in on hover: `opacity-0 → hover:opacity-100`).
 */
export function OpenSearchButton({ onOpen }: OpenSearchButtonProps) {
  return (
    <>
      <Button
        variant="outline"
        onClick={onOpen}
        className="group text-muted-foreground hidden min-w-62.5 justify-start border-0 p-0 font-normal hover:bg-transparent sm:flex md:w-40 lg:w-64"
      >
        <Icons.Search className="mr-2 size-4.5" />
        <span className="text-sm">Buscar cualquier cosa…</span>
        <kbd className="bg-accent text-muted-foreground pointer-events-none ml-auto hidden h-5 items-center rounded border px-1.5 text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <button
        onClick={onOpen}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-11 items-center justify-center rounded-lg transition-colors sm:hidden"
        aria-label="Buscar"
      >
        <Icons.Search className="size-5" />
      </button>
    </>
  );
}
