"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";

const CreateCategoryDialog = dynamic(
  () => import("~/components/forms/create-category").then((m) => ({ default: m.CreateCategoryDialog })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  depth: number;
  sortOrder: number;
}

interface TreeNode extends CategoryRow { children: TreeNode[] }

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
  const { data: categories, isLoading } = useQuery(trpc.catalog.listCategories.queryOptions());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const tree = useMemo(() => buildTree((categories ?? []) as CategoryRow[]), [categories]);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalCategories = categories?.length ?? 0;

  const filtered = tree.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.children.some((ch) => ch.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            {totalCategories} categorías organizadas jerárquicamente
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <span className="material-symbols-outlined text-lg">add</span> Nueva Categoría
        </button>
      </div>

      <CreateCategoryDialog open={showCreate} onClose={() => setShowCreate(false)} />

      <input
        type="text"
        placeholder="Buscar categoría..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
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
            <div key={category.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                onClick={() => toggle(category.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-base">
                    {category.children.length > 0
                      ? expandedIds.has(category.id) ? "📂" : "📁"
                      : "📄"}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">{category.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {category.children.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {category.children.length} subcategorías
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {expandedIds.has(category.id) ? "▼" : "▶"}
                  </span>
                </div>
              </button>

              {expandedIds.has(category.id) && category.children.length > 0 && (
                <div className="border-t border-border">
                  {category.children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between border-b border-border/20 px-4 py-2.5 pl-14 last:border-0 hover:bg-accent/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">└</span>
                        <p className="text-sm text-muted-foreground">{child.name}</p>
                        <span className="text-xs text-muted-foreground">/{child.slug}</span>
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">folder_off</span>
          <p className="text-sm">No se encontraron categorías</p>
        </div>
      )}
    </div>
  );
}
