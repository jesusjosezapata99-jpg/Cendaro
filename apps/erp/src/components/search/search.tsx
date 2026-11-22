"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import { cn } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { useCurrentUser } from "~/hooks/use-current-user";
import { useDebounce } from "~/hooks/use-debounce";
import { getVisibleNav } from "~/lib/navigation";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const TIER0_DEBOUNCE_MS = 150;
const TIER1_SEMANTIC_DEBOUNCE_MS = 650;

interface ResultItem {
  key: string;
  group: string;
  label: string;
  subtitle: string;
  icon: IconName;
  href?: string;
  triggerSemantic?: boolean;
  badgeText?: string;
  badgeTone?: StatusTone;
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
  const [semanticBoostForced, setSemanticBoostForced] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const rawTrimmed = query.trim();
  const debouncedTier0 = useDebounce(query, TIER0_DEBOUNCE_MS);
  const debouncedTier1 = useDebounce(query, TIER1_SEMANTIC_DEBOUNCE_MS);

  const tier0Query = debouncedTier0.trim().slice(0, 120);
  const tier1Query = debouncedTier1.trim().slice(0, 160);

  const isSearching = rawTrimmed.length >= 2;
  const shouldRunTier0 = tier0Query.length >= 2;

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Tier 0: Instant accent-folded + trigram SQL (<25ms, 0 Gemini calls)
  const { data: searchResults, isFetching: isFetchingTier0 } = useQuery({
    ...trpc.search.global.queryOptions(
      { q: tier0Query },
      { placeholderData: keepPreviousData, staleTime: 30_000 },
    ),
    enabled: shouldRunTier0,
  });

  const tier0EmptyAfterSettle =
    shouldRunTier0 &&
    !isFetchingTier0 &&
    Array.isArray(searchResults) &&
    searchResults.length === 0 &&
    tier0Query === rawTrimmed;

  const shouldRunTier1 =
    tier1Query.length >= 3 && (semanticBoostForced || tier0EmptyAfterSettle);

  // Tier 1: Silent semantic pgvector + RRF fallback when literal SQL returns 0 hits
  const { data: semanticData, isFetching: isFetchingTier1 } = useQuery({
    ...trpc.search.semantic.queryOptions(
      { q: tier1Query, limit: 6 },
      { staleTime: 120_000 },
    ),
    enabled: shouldRunTier1,
  });

  // ── Browse mode (empty query): role-scoped navigation pages + quick create actions
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
        } else if (child.href !== parent.href) {
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
    if (!shouldRunTier0 || !searchResults) return [];
    return searchResults.map((item) => {
      const statusPill =
        item.status && item.statusDomain
          ? getStatus(item.statusDomain, item.status)
          : null;
      return {
        key: `${item.type}-${item.id}`,
        group: TYPE_GROUP_LABEL[item.type] ?? item.type,
        label: item.title,
        subtitle: item.subtitle,
        icon: TYPE_ICON[item.type] ?? "Search",
        href: item.href,
        badgeText: statusPill?.label,
        badgeTone: statusPill?.tone,
      };
    });
  }, [shouldRunTier0, searchResults]);

  const semanticItems: ResultItem[] = useMemo(() => {
    if (!shouldRunTier1 || !semanticData) return [];
    const existingProductIds = new Set(
      (searchResults ?? [])
        .filter((r) => r.type === "product")
        .map((r) => r.id),
    );

    const out: ResultItem[] = [];
    for (const prod of semanticData.products) {
      if (existingProductIds.has(prod.id)) continue;
      const metaParts = [
        `SKU ${prod.sku}`,
        prod.brandName,
        prod.categoryName,
      ].filter(Boolean);
      out.push({
        key: `sem-prod-${prod.id}`,
        group: "Coincidencias semánticas",
        label: prod.name,
        subtitle: metaParts.join(" · "),
        icon: "ManageSearch",
        href: prod.href,
      });
    }

    for (const doc of semanticData.documents) {
      out.push({
        key: `sem-doc-${doc.chunkId}`,
        group: "Documentos comerciales",
        label: doc.documentNumber
          ? `${doc.title} (${doc.documentNumber})`
          : doc.title,
        subtitle: doc.snippet,
        icon: "Description",
        href: doc.href,
      });
    }

    return out;
  }, [shouldRunTier1, semanticData, searchResults]);

  const semanticExpandItems: ResultItem[] = useMemo(() => {
    if (
      !isSearching ||
      rawTrimmed.length < 3 ||
      semanticBoostForced ||
      tier0EmptyAfterSettle ||
      entityItems.length === 0
    ) {
      return [];
    }
    return [
      {
        key: "helper-semantic",
        group: "Búsqueda ampliada",
        label: "Ampliar por significado e idioma (Packing Lists / Catálogo)",
        subtitle: "Busca equivalentes en español, inglés o mandarín",
        icon: "ManageSearch",
        triggerSemantic: true,
      },
    ];
  }, [
    isSearching,
    rawTrimmed.length,
    semanticBoostForced,
    tier0EmptyAfterSettle,
    entityItems.length,
  ]);

  const groupedResults = useMemo(() => {
    if (!isSearching) {
      return [...pageItems, ...actionItems];
    }
    return [...entityItems, ...semanticItems, ...semanticExpandItems];
  }, [
    isSearching,
    pageItems,
    actionItems,
    entityItems,
    semanticItems,
    semanticExpandItems,
  ]);

  const groupOrder = !isSearching
    ? ["Páginas", "Acciones rápidas"]
    : [
        "Productos",
        "Clientes",
        "Pedidos",
        "Cotizaciones",
        "Contenedores",
        "Proveedores",
        "Coincidencias semánticas",
        "Documentos comerciales",
        "Búsqueda ampliada",
      ];

  const orderedGroups = groupOrder
    .map((group) => ({
      group,
      items: groupedResults.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0);

  const flatItems = orderedGroups.flatMap((g) => g.items);
  const safeSelectedIndex =
    flatItems.length === 0 ? 0 : Math.min(selectedIndex, flatItems.length - 1);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, semanticBoostForced]);

  useEffect(() => {
    if (selectedIndex !== safeSelectedIndex) {
      setSelectedIndex(safeSelectedIndex);
    }
  }, [selectedIndex, safeSelectedIndex]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const activeRow = container.querySelector<HTMLElement>(
      `[data-search-row="${safeSelectedIndex}"]`,
    );
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [safeSelectedIndex]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContentHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function handleQueryChange(nextValue: string) {
    setQuery(nextValue);
    if (semanticBoostForced) {
      setSemanticBoostForced(false);
    }
  }

  function handleSelect(item: ResultItem) {
    if (item.triggerSemantic) {
      setSemanticBoostForced(true);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (item.href) {
      onClose();
      router.push(item.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) =>
        flatItems.length > 0 ? Math.min(i + 1, flatItems.length - 1) : 0,
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && flatItems[safeSelectedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[safeSelectedIndex]);
    }
  }

  const isAnyLoading =
    (isFetchingTier0 && shouldRunTier0) || (isFetchingTier1 && shouldRunTier1);

  let flatIndex = 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center gap-3 border-b px-4">
        <Icons.Search className="text-muted-foreground size-4.5 shrink-0" />
        <input
          ref={inputRef}
          id="global-search-input"
          name="global-search"
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar páginas, productos, clientes, pedidos o contenedores..."
          aria-label="Buscar páginas, productos, clientes, pedidos o contenedores"
          className="text-foreground placeholder:text-muted-foreground h-12 w-full border-none bg-transparent text-sm outline-none"
          autoComplete="off"
          spellCheck={false}
          maxLength={160}
        />
        {isAnyLoading ? (
          <span className="loading-ellipsis text-muted-foreground/60 shrink-0 text-xs" />
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
          {rawTrimmed.length === 1 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Icons.Search className="text-muted-foreground/50 size-7.5" />
              <p className="text-muted-foreground text-sm">
                Escribe al menos 2 caracteres
              </p>
            </div>
          ) : flatItems.length === 0 && isSearching && !isAnyLoading ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Icons.SearchOff className="text-muted-foreground size-7.5" />
              <p className="text-muted-foreground text-sm">
                No se encontraron resultados
              </p>
              <p className="text-muted-foreground/60 text-xs">
                Prueba con otro nombre, SKU, RIF o número de orden
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
                      data-search-row={idx}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "group/row flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        idx === safeSelectedIndex
                          ? "bg-accent text-foreground"
                          : "text-foreground/80 hover:bg-accent/50",
                      )}
                    >
                      <Icon
                        name={item.icon}
                        className="text-nav-icon size-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.label}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.subtitle}
                        </p>
                      </div>
                      {item.badgeText ? (
                        <StatusPill
                          tone={item.badgeTone ?? "neutral"}
                          className="shrink-0 font-mono tabular-nums"
                        >
                          {item.badgeText}
                        </StatusPill>
                      ) : null}
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
