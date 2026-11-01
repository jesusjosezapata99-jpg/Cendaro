"use client";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { TodayStats } from "./types";
import type { useBcvRate } from "~/hooks/use-bcv-rate";

interface PosToolbarProps {
  bcv: ReturnType<typeof useBcvRate>;
  todayStats: TodayStats;
  revenueDual: { usd: string; bs: string };
  avgDual: { usd: string; bs: string };
  cartLength: number;
  totalCartUnits: number;
  onClearCart: () => void;
  isRegisterClosedToday?: boolean;
}

export function PosToolbar({
  bcv,
  todayStats,
  revenueDual,
  avgDual,
  cartLength,
  totalCartUnits,
  onClearCart,
  isRegisterClosedToday = false,
}: PosToolbarProps) {
  return (
    <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 border px-4 py-2.5 shadow-xs">
      {/* Left: Terminal Identity + Register Status + Operational Metrics */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary border-primary/20 flex size-8 items-center justify-center border">
            <Icons.BarcodeScanner className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-foreground text-sm font-medium tracking-tight">
                Terminal POS
              </h1>
              <StatusPill tone={isRegisterClosedToday ? "warning" : "success"}>
                {isRegisterClosedToday ? "Caja Cerrada Hoy" : "Caja Abierta"}
              </StatusPill>
            </div>
            <p className="text-muted-foreground hidden text-[11px] xl:block">
              Facturación rápida de mostrador · Multimoneda BCV
            </p>
          </div>
        </div>

        <div className="bg-border hidden h-6 w-px sm:block" />

        {/* Live Shift Metrics */}
        <div className="hidden flex-wrap items-center gap-3 text-xs md:flex">
          <div className="bg-secondary/50 border-border flex items-center gap-1.5 border px-2.5 py-1">
            <Icons.ReceiptLong className="text-primary size-3.5" />
            <span className="text-muted-foreground">Turno:</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {todayStats.count} ({revenueDual.usd})
            </span>
          </div>

          <div className="bg-secondary/50 border-border hidden items-center gap-1.5 border px-2.5 py-1 lg:flex">
            <Icons.Analytics className="text-muted-foreground size-3.5" />
            <span className="text-muted-foreground">Promedio:</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {avgDual.usd}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Official BCV Rate + Active Ticket Counter + Clear Action */}
      <div className="flex flex-wrap items-center gap-2">
        {/* BCV Official Rate Badge with Live Sync Button */}
        <div className="border-border bg-secondary/70 flex min-h-9 items-center gap-2 border px-2.5 py-1 text-xs font-medium">
          <Icons.Verified className="text-primary size-3.5" />
          <span className="text-muted-foreground hidden sm:inline">BCV:</span>
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
            aria-label="Sincronizar tasa oficial BCV"
            className="text-muted-foreground hover:text-primary flex size-6 items-center justify-center transition-colors disabled:opacity-50"
          >
            <Icons.Sync
              className={`size-3.5 ${bcv.isSyncing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Active Cart Counter Chip */}
        <div
          className={`flex min-h-9 items-center gap-1.5 border px-2.5 py-1 font-mono text-xs font-medium tabular-nums transition-colors ${
            cartLength > 0
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground"
          }`}
        >
          <Icons.ShoppingCart className="size-3.5" />
          <span>
            {totalCartUnits} un. · {cartLength} líns.
          </span>
        </div>

        {cartLength > 0 && (
          <Button
            variant="outline"
            onClick={onClearCart}
            className="min-h-9 px-2.5 text-xs"
          >
            <Icons.RestartAlt className="size-3.5" />
            Vaciar
          </Button>
        )}
      </div>
    </div>
  );
}
