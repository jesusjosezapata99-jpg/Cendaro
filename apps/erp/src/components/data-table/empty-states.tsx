"use client";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

interface DataTableEmptyStateProps {
  title?: string;
  description?: string;
  onResetFilters?: () => void;
  resetButtonText?: string;
}

export function DataTableEmptyState({
  title = "Sin resultados",
  description = "Prueba otra búsqueda o ajusta los filtros seleccionados.",
  onResetFilters,
  resetButtonText = "Limpiar filtros",
}: DataTableEmptyStateProps) {
  return (
    <div
      data-slot="data-table-empty-state"
      className="animate-in fade-in mt-32 mb-32 flex flex-col items-center justify-center text-center duration-200"
    >
      <div className="border-border bg-accent/40 text-muted-foreground mb-4 flex size-12 items-center justify-center border">
        <Icons.SearchOff className="size-6" />
      </div>

      <h3 className="text-foreground font-serif text-[18px] font-normal">
        {title}
      </h3>

      <p className="text-muted-foreground mt-1.5 max-w-sm text-xs">
        {description}
      </p>

      {onResetFilters ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResetFilters}
          className="mt-5 text-xs font-normal"
        >
          <Icons.Close className="mr-1.5 size-3.5" />
          {resetButtonText}
        </Button>
      ) : null}
    </div>
  );
}

interface DataTableErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryButtonText?: string;
}

/**
 * DataTable Error State (PLAN-2026-09-DESIGN-SYSTEM §T8.10, C4)
 *
 * Differentiates network/server failure from genuine empty results.
 */
export function DataTableErrorState({
  title = "No se pudo cargar la información",
  description = "Ocurrió un problema de conexión o del servidor al consultar los datos.",
  onRetry,
  retryButtonText = "Reintentar",
}: DataTableErrorStateProps) {
  return (
    <div
      data-slot="data-table-error-state"
      className="animate-in fade-in mt-32 mb-32 flex flex-col items-center justify-center text-center duration-200"
    >
      <div className="border-destructive/40 bg-destructive/10 text-destructive mb-4 flex size-12 items-center justify-center border">
        <Icons.Error className="size-6" />
      </div>

      <h3 className="text-foreground font-serif text-[18px] font-normal">
        {title}
      </h3>

      <p className="text-muted-foreground mt-1.5 max-w-sm text-xs">
        {description}
      </p>

      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-5 text-xs font-normal"
        >
          <Icons.Refresh className="mr-1.5 size-3.5" />
          {retryButtonText}
        </Button>
      ) : null}
    </div>
  );
}
