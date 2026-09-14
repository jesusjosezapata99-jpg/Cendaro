"use client";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { TodayStats } from "./types";
import type { useBcvRate } from "~/hooks/use-bcv-rate";
import { PageHeader } from "~/components/page-header";

interface PosToolbarProps {
  bcv: ReturnType<typeof useBcvRate>;
  todayStats: TodayStats;
  revenueDual: { usd: string; bs: string };
  avgDual: { usd: string; bs: string };
  cartLength: number;
  totalCartUnits: number;
  onClearCart: () => void;
}

export function PosToolbar({
  bcv,
  todayStats,
  revenueDual,
  avgDual,
  cartLength,
  totalCartUnits,
  onClearCart,
}: PosToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Top Header */}
      <PageHeader
        title="Terminal Punto de Venta (POS)"
        description="Mostrador de alta velocidad, lector de código de barras y cobro dual con tasa oficial BCV"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Text-only per §5.3 — StatusPill truncates its children, so an
                inline icon overlaps the label instead of sitting beside it. */}
            <StatusPill tone="success">Caja Abierta</StatusPill>

            {/* BCV Official Rate Badge with Live Sync Button */}
            <div className="border-border bg-secondary/80 flex min-h-11 items-center gap-2 border px-3 py-1.5 text-xs font-medium shadow-xs">
              <Icons.Verified className="text-primary size-4" />
              <span className="text-muted-foreground hidden sm:inline">
                BCV Oficial:
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {bcv.isLoading
                  ? "Cargando..."
                  : `Bs ${bcv.rate.toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}`}
              </span>
              <button
                type="button"
                onClick={() => void bcv.syncRate()}
                disabled={bcv.isSyncing}
                title="Actualizar tasa oficial directamente desde bcv.org.ve"
                className="text-muted-foreground hover:text-primary ml-0.5 flex min-h-8 min-w-8 items-center justify-center p-1 transition-colors disabled:opacity-50"
              >
                <Icons.Sync
                  className={`size-3.5 ${bcv.isSyncing ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {cartLength > 0 && (
              <Button
                variant="outline"
                onClick={onClearCart}
                className="min-h-11 text-xs"
              >
                <Icons.RestartAlt className="size-3.5" />
                Limpiar Carrito
              </Button>
            )}
          </div>
        }
      />

      {/* Compact Operational Stats Toolbar (Saves vertical space for cashier) */}
      <div className="border-border bg-card/60 flex flex-wrap items-center justify-between gap-3 border px-4 py-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Icons.ReceiptLong className="text-primary size-4" />
            <span className="text-muted-foreground">Ventas Turno:</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {todayStats.count} ({revenueDual.usd})
            </span>
          </div>

          <div className="text-border hidden sm:inline-block">|</div>

          <div className="hidden items-center gap-1.5 sm:flex">
            <Icons.Analytics className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">Ticket Promedio:</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {avgDual.usd}
            </span>
          </div>

          <div className="text-border hidden md:inline-block">|</div>

          <div className="hidden items-center gap-1.5 md:flex">
            <Icons.CalendarToday className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">Fecha Valor:</span>
            <span className="text-foreground font-mono text-[11px] font-medium">
              {bcv.dateText ?? bcv.date}
            </span>
          </div>
        </div>

        {/* Active Cart Counter Chip */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition-colors ${
              cartLength > 0
                ? "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            <Icons.ShoppingCart className="size-3.5" />
            <span>
              {totalCartUnits} un. ({cartLength} ítems)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
