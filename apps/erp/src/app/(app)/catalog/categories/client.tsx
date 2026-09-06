"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { Button, Input } from "@cendaro/ui";

import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { useTRPC } from "~/trpc/client";

const CreateCategoryDialog = dynamic(
  () =>
    import("~/components/forms/create-category").then((m) => ({
      default: m.CreateCategoryDialog,
    })),
  { ssr: false },
);

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
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Categorías"
        description={`${totalCategories.toLocaleString("es-VE")} categorías organizadas jerárquicamente`}
        actions={
          <Button onClick={() => setShowCreate(true)} className="min-h-11">
            <span className="material-symbols-outlined text-lg">add</span>
            Nueva Categoría
          </Button>
        }
      />

      <CreateCategoryDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Search */}
      <div className="relative">
        <span
          aria-hidden
          className="material-symbols-outlined text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base"
        >
          search
        </span>
        <Input
          type="text"
          placeholder="Buscar categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((category) => {
            const isExpanded = expandedIds.has(category.id);
            const hasChildren = category.children.length > 0;
            return (
              <div
                key={category.id}
                className="border-border-subtle surface-card overflow-hidden rounded-xl border"
              >
                <button
                  onClick={() => toggle(category.id)}
                  aria-expanded={isExpanded}
                  className="hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors outline-none"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="bg-secondary text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
                    >
                      <span className="material-symbols-outlined text-base">
                        {hasChildren ? "category" : "description"}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground truncate font-medium">
                        {category.name}
                      </p>
                      <p className="text-muted-foreground truncate font-mono text-xs">
                        {category.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {hasChildren && (
                      <span className="text-muted-foreground font-mono text-xs tabular-nums">
                        {category.children.length}{" "}
                        {category.children.length === 1
                          ? "subcategoría"
                          : "subcategorías"}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className={`material-symbols-outlined text-muted-foreground text-base transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      } motion-reduce:transition-none`}
                    >
                      expand_more
                    </span>
                  </div>
                </button>

                {isExpanded && hasChildren && (
                  <div className="border-border-subtle border-t">
                    {category.children.map((child) => (
                      <div
                        key={child.id}
                        className="hover:bg-accent/30 animate-in fade-in slide-in-from-top-1 flex items-center gap-3 border-b py-2.5 pr-4 pl-14 text-sm duration-150 last:border-b-0"
                      >
                        <span
                          aria-hidden
                          className="border-border w-3 shrink-0 border-b-2"
                        />
                        <span className="text-muted-foreground truncate">
                          {child.name}
                        </span>
                        <span className="text-muted-foreground/70 truncate font-mono text-xs">
                          /{child.slug}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <EmptyState
          icon="folder_off"
          title="No se encontraron categorías"
          description="Ajusta la búsqueda o crea una nueva categoría para empezar."
        />
      )}
    </div>
  );
}
