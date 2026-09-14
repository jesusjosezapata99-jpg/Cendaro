"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
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
    <SheetModal
      open={open}
      onClose={onClose}
      title="Nueva Marca"
      description="Registra una nueva marca de producto en el catálogo."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, slug, description: description || undefined });
        }}
        className="flex h-full flex-col"
      >
        <SheetBody>
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre *</label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Descripción
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetFormActions
            onCancel={onClose}
            submitting={create.isPending}
            submitLabel="Crear Marca"
            disabled={!name}
          />
        </SheetFooter>
      </form>
    </SheetModal>
  );
}

export const CreateBrandSheet = CreateBrandDialog;
