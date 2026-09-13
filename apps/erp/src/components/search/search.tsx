"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { cn } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import { useCurrentUser } from "~/hooks/use-current-user";
import { getVisibleNav } from "~/lib/navigation";
import { useTRPC } from "~/trpc/client";

const DEBOUNCE_MS = 150;

/** Small inline debounce — the codebase has no `use-debounce` dependency
 * yet and this is a 6-line utility, so one wasn't added just for this. */
function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface ResultItem {
  key: string;
  group: string;
  label: string;
  subtitle: string;
  icon: IconName;
  href: string;
  status?: string;
}

const TYPE_ICON: Record<string, IconName> = {
  product: "Inventory2",
  customer: "Person",
  order: "ReceiptLong",
  quote: "RequestQuote",
  container: "Package2",
  supplier: "LocalShipping",
};

const TYPE_GROUP_LABEL: Record<string, string> = {
  product: "Productos",
  customer: "Clientes",
  order: "Pedidos",
  quote: "Cotizaciones",
  container: "Contenedores",
  supplier: "Proveedores",
};

interface SearchProps {
  onClose: () => void;
}

export function Search({ onClose }: SearchProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const { profile } = useCurrentUser();
  const role = profile?.role ?? null;

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const trimmed = debouncedQuery.trim();
  const isSearching = trimmed.length >= 2;

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const { data: searchResults, isFetching } = useQuery({
    ...trpc.search.global.queryOptions(
      { q: trimmed },
      { placeholderData: keepPreviousData },
    ),
    enabled: isSearching,
  });

  // ── Browse mode (empty query): pages + quick-create actions from the
  // same NAV_ITEMS/getVisibleNav source of truth the rail uses — no
  // separate `roles: UserRole[]` list duplicated here (T2.1's own lesson).
  const { pageItems, actionItems } = useMemo(() => {
    const visible = getVisibleNav(role);
    const pages: ResultItem[] = [];
    const actions: ResultItem[] = [];

    for (const parent of visible) {
      if (parent.href) {
        pages.push({
          key: `page-${parent.id}`,
          group: "Páginas",
          label: parent.label,
          subtitle: parent.resolvedHref,
          icon: parent.icon,
          href: parent.resolvedHref,
        });
      }
      for (const child of parent.children ?? []) {
        if (child.kind === "create") {
          actions.push({
            key: `action-${child.href}`,
            group: "Acciones rápidas",
            label: child.label,
            subtitle: child.href,
            icon: parent.icon,
            href: child.href,
          });
        } else if (!parent.href) {
          pages.push({
            key: `page-${parent.id}-${child.href}`,
            group: "Páginas",
            label: child.label,
            subtitle: child.href,
            icon: parent.icon,
            href: child.href,
          });
        }
      }
    }

    return { pageItems: pages, actionItems: actions };
  }, [role]);

  const entityItems: ResultItem[] = useMemo(() => {
    if (!isSearching || !searchResults) return [];
    return searchResults.map((item) => ({
      key: `${item.type}-${item.id}`,
      group: TYPE_GROUP_LABEL[item.type] ?? item.type,
      label: item.title,
      subtitle: item.status
        ? `${item.subtitle} · ${item.status}`
        : item.subtitle,
      icon: TYPE_ICON[item.type] ?? "Search",
      href: item.href,
    }));
  }, [isSearching, searchResults]);

  const groupedResults = isSearching
    ? entityItems
    : [...pageItems, ...actionItems];

  // Stable group order: entity types follow their §T2.11 declaration order;
  // browse mode is pages first, then actions.
  const groupOrder = isSearching
    ? [
        "Productos",
        "Clientes",
        "Pedidos",
        "Cotizaciones",
        "Contenedores",
        "Proveedores",
      ]
    : ["Páginas", "Acciones rápidas"];

  const orderedGroups = groupOrder
    .map((group) => ({
      group,
      items: groupedResults.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0);

  const flatItems = orderedGroups.flatMap((g) => g.items);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // M-19: the results panel's height animates (100ms ease, capped 450px) as
  // its content grows/shrinks — measure the real content, don't guess it.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContentHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [orderedGroups.length]);

  function handleSelect(item: ResultItem) {
    onClose();
    router.push(item.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && flatItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[selectedIndex]);
    }
  }

  let flatIndex = 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center gap-3 border-b px-4">
        <Icons.Search className="text-muted-foreground size-4.5" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar páginas, productos, clientes, pedidos..."
          className="text-foreground placeholder:text-muted-foreground h-12 w-full border-none bg-transparent text-sm outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {isFetching && isSearching ? (
          <span className="loading-ellipsis text-muted-foreground/60 text-xs" />
        ) : null}
      </div>

      <div
        className="search-results-list overflow-y-auto"
        style={
          {
            "--search-list-height": `${contentHeight}px`,
          } as React.CSSProperties
        }
      >
        <div ref={contentRef} className="p-1.5">
          {trimmed.length === 1 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Icons.Search className="text-muted-foreground/50 size-7.5" />
              <p className="text-muted-foreground text-sm">
                Escribe al menos 2 caracteres
              </p>
            </div>
          ) : flatItems.length === 0 && isSearching ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Icons.SearchOff className="text-muted-foreground size-7.5" />
              <p className="text-muted-foreground text-sm">
                No se encontraron resultados
              </p>
              <p className="text-muted-foreground/60 text-xs">
                Intenta con otro término de búsqueda
              </p>
            </div>
          ) : (
            orderedGroups.map(({ group, items }) => (
              <div key={group}>
                <div className="text-muted-foreground px-3 pt-3 pb-1 text-xs font-medium tracking-wide">
                  {group}
                </div>
                {items.map((item) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "group/row flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        idx === selectedIndex
                          ? "bg-accent text-foreground"
                          : "text-foreground/80 hover:bg-accent/50",
                      )}
                    >
                      <Icon name={item.icon} className="text-nav-icon size-4" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.label}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.subtitle}
                        </p>
                      </div>
                      <Icons.ArrowOutward className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
