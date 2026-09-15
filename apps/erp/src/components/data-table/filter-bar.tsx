"use client";

import * as React from "react";

import { Button, cn } from "@cendaro/ui";
import { Checkbox } from "@cendaro/ui/checkbox";
import { Icons } from "@cendaro/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@cendaro/ui/popover";

/* -------------------------------------------------------------------------- */
/* 1. Search Input                                                            */
/* -------------------------------------------------------------------------- */

export interface DataTableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function DataTableSearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  autoFocus,
}: DataTableSearchInputProps) {
  return (
    <div
      data-slot="data-table-search"
      className={cn(
        "border-border focus-within:border-foreground/40 bg-background flex h-9 items-center gap-2 border px-2.5 transition-colors",
        className,
      )}
    >
      <Icons.Search className="text-muted-foreground size-4 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="text-foreground placeholder:text-muted-foreground/60 h-full w-full bg-transparent text-sm outline-none focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
        >
          <Icons.Close className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Filter Popover                                                          */
/* -------------------------------------------------------------------------- */

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterSection {
  id: string;
  title: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

export interface DataTableFilterPopoverProps {
  sections?: FilterSection[];
  activeCount?: number;
  onClearAll?: () => void;
  children?: React.ReactNode;
  triggerLabel?: string;
  className?: string;
}

export function DataTableFilterPopover({
  sections,
  activeCount = 0,
  onClearAll,
  children,
  triggerLabel = "Filtros",
  className,
}: DataTableFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-slot="filter-popover-trigger"
          className={cn(
            "h-9 gap-1.5 px-3 text-xs font-normal select-none",
            activeCount > 0 && "border-foreground/40 text-foreground",
            className,
          )}
        >
          <Icons.Tune className="size-3.5 shrink-0" />
          <span>{triggerLabel}</span>
          {activeCount > 0 ? (
            <span className="bg-foreground text-background flex size-4 items-center justify-center font-mono text-[10px] tabular-nums">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="border-border bg-background text-foreground w-72 p-0 shadow-md"
      >
        <div className="border-border flex items-center justify-between border-b px-3.5 py-2.5">
          <span className="text-xs font-medium tracking-wide">Filtros</span>
          {activeCount > 0 && onClearAll ? (
            <button
              type="button"
              onClick={onClearAll}
              className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4 transition-colors"
            >
              Limpiar todo
            </button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto p-3">
          {sections && sections.length > 0 ? (
            <div className="flex flex-col gap-4">
              {sections.map((section) => (
                <div key={section.id} className="flex flex-col gap-2">
                  <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                    {section.title}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {section.options.map((option) => {
                      const isChecked = section.selectedValues.includes(
                        option.value,
                      );
                      return (
                        <label
                          key={option.value}
                          className="hover:bg-accent/40 flex cursor-pointer items-center justify-between px-1.5 py-1 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() =>
                                section.onToggle(option.value)
                              }
                            />
                            <span
                              className={cn(
                                isChecked
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground",
                              )}
                            >
                              {option.label}
                            </span>
                          </div>
                          {option.count !== undefined ? (
                            <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                              {option.count}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Filter Chips                                                            */
/* -------------------------------------------------------------------------- */

export interface ActiveFilterItem {
  id: string;
  label: string;
  valueLabel: string;
  onRemove: () => void;
}

export interface DataTableFilterChipsProps {
  filters: ActiveFilterItem[];
  onClearAll?: () => void;
  className?: string;
}

export function DataTableFilterChips({
  filters,
  onClearAll,
  className,
}: DataTableFilterChipsProps) {
  if (!filters.length) return null;

  return (
    <div
      data-slot="data-table-filter-chips"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {filters.map((filter) => (
        <div
          key={filter.id}
          className="border-border bg-secondary/30 hover:border-foreground/30 flex items-center gap-1.5 border px-2 py-0.5 text-xs transition-colors select-none"
        >
          <span className="text-muted-foreground">{filter.label}:</span>
          <span className="text-foreground font-mono tabular-nums">
            {filter.valueLabel}
          </span>
          <button
            type="button"
            onClick={filter.onRemove}
            aria-label={`Remover filtro ${filter.label}`}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/50 p-0.5 transition-colors"
          >
            <Icons.Close className="size-3" />
          </button>
        </div>
      ))}

      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground ml-1 text-xs underline underline-offset-4 transition-colors"
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Complete Filter Bar Orchestrator                                        */
/* -------------------------------------------------------------------------- */

export interface DataTableFilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  popover?: DataTableFilterPopoverProps;
  activeFilters?: ActiveFilterItem[];
  onClearAllFilters?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function DataTableFilterBar({
  search,
  popover,
  activeFilters = [],
  onClearAllFilters,
  actions,
  className,
}: DataTableFilterBarProps) {
  return (
    <div
      data-slot="data-table-filter-bar"
      className={cn("flex w-full flex-col gap-2.5 pb-3", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {search ? (
            <DataTableSearchInput
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder}
              className="max-w-xs flex-1"
            />
          ) : null}

          {popover ? <DataTableFilterPopover {...popover} /> : null}
        </div>

        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {activeFilters.length > 0 ? (
        <DataTableFilterChips
          filters={activeFilters}
          onClearAll={onClearAllFilters}
        />
      ) : null}
    </div>
  );
}
