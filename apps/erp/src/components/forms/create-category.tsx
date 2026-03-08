"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "~/components/dialog";

export function CreateCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const create = useMutation(
    trpc.catalog.createCategory.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
        setName(""); setSlug("");
        onClose();
      },
    }),
  );

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nueva Categoría">
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate({ name, slug }); }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre *</label>
          <input value={name} onChange={(e) => handleNameChange(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button type="submit" disabled={create.isPending || !name} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {create.isPending ? "Creando..." : "Crear Categoría"}
        </button>
      </form>
    </Dialog>
  );
}
