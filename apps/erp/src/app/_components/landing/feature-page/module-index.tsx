"use client";

import { useDeferredValue, useId, useState } from "react";
import Link from "next/link";

import type { IconName } from "@cendaro/ui/icons";
import { Icon, Icons } from "@cendaro/ui/icons";

export interface ModuleEntry {
  id: string;
  name: string;
  line: string;
  icon: IconName;
  group: string;
  href?: string;
}

interface ModuleIndexProps {
  groups: readonly string[];
  modules: readonly ModuleEntry[];
}

/** Lowercase without accents, so "importacion" finds "Importaciones". */
const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Module index with a local text filter (plan T5.4): no network, results
 * counted in a polite live region. Without JavaScript every module is
 * listed, since the server render has an empty query.
 */
export function ModuleIndex({ groups, modules }: ModuleIndexProps) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const inputId = useId();
  const listId = useId();

  const needle = normalize(deferred.trim());
  const visible = needle
    ? modules.filter((m) =>
        normalize(`${m.name} ${m.line} ${m.group}`).includes(needle),
      )
    : modules;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={inputId} className="sr-only">
          Buscar un módulo
        </label>
        <div className="border-border focus-within:ring-ring flex h-12 w-full items-center gap-3 border px-4 focus-within:ring-1 sm:max-w-sm">
          <Icons.Search className="text-muted-foreground size-5 shrink-0" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-controls={listId}
            placeholder="Buscar: tasas, almacén, WhatsApp…"
            autoComplete="off"
            className="placeholder:text-muted-foreground h-full w-full bg-transparent outline-none"
          />
        </div>
        <p
          aria-live="polite"
          className="text-muted-foreground font-mono text-sm tabular-nums"
        >
          {visible.length === modules.length
            ? `${modules.length} módulos`
            : `${visible.length} de ${modules.length} módulos`}
        </p>
      </div>

      <div id={listId} className="mt-10 flex flex-col gap-10">
        {groups.map((group) => {
          const items = visible.filter((m) => m.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group} aria-label={group}>
              <h3 className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                {group}
              </h3>
              <ul className="border-border mt-4 grid grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <li
                    key={m.id}
                    id={m.id}
                    className="border-border scroll-mt-24 border-r border-b"
                  >
                    <ModuleCell entry={m} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 ? (
          <p className="text-muted-foreground">
            Ningún módulo coincide con «{query}». Prueba con otra palabra.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ModuleCell({ entry }: { entry: ModuleEntry }) {
  const body = (
    <>
      <span className="border-border flex size-10 shrink-0 items-center justify-center border">
        <Icon name={entry.icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{entry.name}</span>
        <span className="text-muted-foreground mt-1 block text-sm leading-snug">
          {entry.line}
        </span>
      </span>
    </>
  );

  if (!entry.href) {
    return <div className="flex h-full gap-4 p-5">{body}</div>;
  }
  return (
    <Link
      href={entry.href}
      className="group hover:bg-muted flex h-full gap-4 p-5 transition-colors duration-(--motion-micro)"
    >
      {body}
      <Icons.ArrowForward
        aria-hidden="true"
        className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform duration-(--motion-micro) group-hover:translate-x-0.5"
      />
    </Link>
  );
}
