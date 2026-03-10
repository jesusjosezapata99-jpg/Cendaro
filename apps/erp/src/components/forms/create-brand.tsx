"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Dialog } from "~/components/dialog";
import { useTRPC } from "~/trpc/client";

export function CreateBrandDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation(
    trpc.catalog.createBrand.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
        setName("");
        setSlug("");
        setDescription("");
        onClose();
      },
    }),
  );

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(
      v
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nueva Marca">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, slug, description: description || undefined });
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={create.isPending || !name}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
        >
          {create.isPending ? "Creando..." : "Crear Marca"}
        </button>
      </form>
    </Dialog>
  );
}
