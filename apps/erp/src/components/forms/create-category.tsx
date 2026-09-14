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

export function CreateCategoryDialog({
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

  const create = useMutation(
    trpc.catalog.createCategory.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
        setName("");
        setSlug("");
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
      title="Nueva Categoría"
      description="Registra una nueva categoría para organizar productos en el catálogo."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, slug });
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
        </SheetBody>

        <SheetFooter>
          <SheetFormActions
            onCancel={onClose}
            submitting={create.isPending}
            submitLabel="Crear Categoría"
            disabled={!name}
          />
        </SheetFooter>
      </form>
    </SheetModal>
  );
}

export const CreateCategorySheet = CreateCategoryDialog;
