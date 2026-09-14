"use client";

import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@cendaro/ui/dialog";

import { OpenSearchButton } from "./open-search-button";
import { Search } from "./search";
import { SearchFooter } from "./search-footer";

/**
 * Global search palette — PLAN-2026-09-DESIGN-SYSTEM §T2.12, M-19.
 * Replaced the old `command-search.tsx` (deleted in T2.14).
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
          className="top-[15vh] h-133.75 max-w-[92vw] translate-y-0 border-none bg-transparent p-0 max-md:top-auto max-md:h-[70vh] max-md:max-h-[70vh] md:max-w-185"
        >
          <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
          <div className="border-border bg-card flex h-full w-full flex-col overflow-hidden border shadow-md">
            <Search onClose={() => setOpen(false)} />
            <SearchFooter />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
