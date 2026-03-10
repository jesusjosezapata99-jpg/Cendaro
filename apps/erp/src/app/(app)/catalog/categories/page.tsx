"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const CreateCategoryDialog = dynamic(
  () =>
    import("~/components/forms/create-category").then((m) => ({
      default: m.CreateCategoryDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  depth: number;
  sortOrder: number;
}

interface TreeNode extends CategoryRow {
  children: TreeNode[];
}

function buildTree(flat: CategoryRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const cat of flat) map.set(cat.id, { ...cat, children: [] });
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export default function CategoriesPage() {
  const trpc = useTRPC();
  const { data: categories, isLoading } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const tree = useMemo(
    () => buildTree((categories ?? []) as CategoryRow[]),
    [categories],
  );

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCategories = categories?.length ?? 0;

  const filtered = tree.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.children.some((ch) =>
        ch.name.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Categorías
          </h1>
          <p className="text-muted-foreground text-sm">
            {totalCategories} categorías organizadas jerárquicamente
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-lg">add</span> Nueva
          Categoría
        </button>
      </div>

      <CreateCategoryDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <input
        type="text"
        placeholder="Buscar categoría..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((category) => (
            <div
              key={category.id}
              className="border-border bg-card overflow-hidden rounded-xl border"
            >
              <button
                onClick={() => toggle(category.id)}
                className="hover:bg-accent/50 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-secondary flex h-8 w-8 items-center justify-center rounded-lg text-base">
                    {category.children.length > 0
                      ? expandedIds.has(category.id)
                        ? "📂"
                        : "📁"
                      : "📄"}
                  </span>
                  <div>
                    <p className="text-foreground font-medium">
                      {category.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {category.slug}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {category.children.length > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {category.children.length} subcategorías
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {expandedIds.has(category.id) ? "▼" : "▶"}
                  </span>
                </div>
              </button>

              {expandedIds.has(category.id) && category.children.length > 0 && (
                <div className="border-border border-t">
                  {category.children.map((child) => (
                    <div
                      key={child.id}
                      className="border-border/20 hover:bg-accent/10 flex items-center justify-between border-b px-4 py-2.5 pl-14 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">└</span>
                        <p className="text-muted-foreground text-sm">
                          {child.name}
                        </p>
                        <span className="text-muted-foreground text-xs">
                          /{child.slug}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            folder_off
          </span>
          <p className="text-sm">No se encontraron categorías</p>
        </div>
      )}
    </div>
  );
}
