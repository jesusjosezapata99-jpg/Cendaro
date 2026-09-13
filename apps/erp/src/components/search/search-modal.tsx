"use client";

import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@cendaro/ui/dialog";

import { OpenSearchButton } from "./open-search-button";
import { Search } from "./search";
import { SearchFooter } from "./search-footer";

/**
 * Global search palette — PLAN-2026-09-MIDDAY-REDESIGN §T2.12, M-19.
 * Replaces `command-search.tsx` (T2.14 deletes the old file once nothing
 * imports it — this is the only remaining reference after this task).
 */
export function SearchModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <OpenSearchButton onOpen={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[15vh] h-[535px] max-w-[92vw] translate-y-0 border-none bg-transparent p-0 max-md:top-auto max-md:h-[70vh] max-md:max-h-[70vh] md:max-w-[740px]"
        >
          <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
          <div className="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-2xl">
            <Search onClose={() => setOpen(false)} />
            <SearchFooter />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
