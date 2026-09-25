import type { ReactNode } from "react";

import type { StatusTone } from "@cendaro/ui/status-pill";
import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { StepId } from "../content";
import { MiniAppShell, MiniStat } from "./app-shell";

/**
 * Product views for the public site, drawn with real app tokens and
 * fictitious sample data ("Distribuidora Aurora", scripts/landing-media/
 * demo-data.mjs). Replaced by recordings (LandingVideo) once they exist;
 * until then they are the product imagery (DESIGN.md §8).
 */

const BCV = 853.4993;
const num = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtUsd = (n: number): string => `USD ${num.format(n)}`;
const fmtBs = (n: number): string => `Bs ${num.format(n * BCV)}`;

function RateChip() {
  return (
    <span className="border-border hidden items-center gap-1.5 border px-2 py-1 font-mono text-xs tabular-nums md:inline-flex">
      <span className="text-muted-foreground">BCV</span>
      {num.format(BCV)}
    </span>
  );
}

function Row({
  cells,
  head = false,
}: {
  cells: readonly ReactNode[];
  head?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border grid grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))] items-center gap-3 border-b px-3 py-2 text-xs last:border-b-0",
        head && "text-muted-foreground bg-card",
      )}
    >
      {cells.map((cell, i) => (
        <span
          key={i}
          className={cn(
            "min-w-0 truncate",
            i > 0 && "text-right font-mono tabular-nums",
          )}
        >
          {cell}
        </span>
      ))}
    </div>
  );
}

const pill = (tone: StatusTone, label: string): ReactNode => (
  <StatusPill tone={tone}>{label}</StatusPill>
);

// ── Dashboard (hero) ──────────────────────────────────────────────────────
const WEEK = [62, 48, 71, 55, 83, 90, 68] as const;
const DAYS = ["L", "M", "M", "J", "V", "S", "D"] as const;
const ACTIVITY: readonly { text: string; tone: StatusTone; label: string }[] = [
  {
    text: "Pedido OC-1042 · Abastos El Sol",
    tone: "info",
    label: "Despachado",
  },
  { text: "Contenedor MSKU 4829137", tone: "info", label: "En Tránsito" },
  { text: "Escoba plástica con palo", tone: "warning", label: "Stock Bajo" },
  { text: "Cierre de caja de ayer", tone: "success", label: "Revisada" },
];

export function DashboardView({ className }: { className?: string }) {
  return (
    <MiniAppShell
      active="Dashboard"
      title="Panel · Distribuidora Aurora"
      meta={<RateChip />}
      className={className}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Ventas de hoy"
          value={fmtUsd(4218.4)}
          hint={fmtBs(4218.4)}
        />
        <MiniStat label="Pedidos abiertos" value="12" hint="3 por despachar" />
        <MiniStat label="Por cobrar" value={fmtUsd(9870.5)} hint="2 vencidas" />
        <MiniStat label="Stock bajo" value="3" hint="productos" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="border-border border p-3">
          <p className="text-muted-foreground text-xs">Ventas de la semana</p>
          <div className="mt-3 flex h-28 items-end gap-2">
            {WEEK.map((v, i) => (
              <div
                key={i}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span
                  className={cn(
                    "w-full",
                    i === 5 ? "bg-foreground" : "bg-muted",
                  )}
                  style={{ height: `${v}%` }}
                />
                <span className="text-muted-foreground font-mono text-[10px]">
                  {DAYS[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-border hidden border sm:block">
          {ACTIVITY.map((row) => (
            <div
              key={row.text}
              className="border-border flex items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0"
            >
              <span className="min-w-0 truncate">{row.text}</span>
              {pill(row.tone, row.label)}
            </div>
          ))}
        </div>
      </div>
    </MiniAppShell>
  );
}

// ── 01 Catalog import ─────────────────────────────────────────────────────
function CatalogImportView() {
  return (
    <MiniAppShell active="Category" title="Importar catálogo · productos.xlsx">
      <div className="text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        <span className="text-foreground">1 Archivo</span>
        <span className="text-foreground">2 Columnas</span>
        <span className="text-foreground">3 Categorías</span>
        <span>4 Confirmar</span>
      </div>
      <div className="border-border border">
        <Row head cells={["Producto", "Costo", "Precio", "Estado"]} />
        <Row
          cells={[
            "Detergente líquido 2 L",
            "2,10",
            "3,90",
            pill("success", "Válido"),
          ]}
        />
        <Row
          cells={[
            "Cloro concentrado 1 L",
            "0,80",
            "1,60",
            pill("success", "Válido"),
          ]}
        />
        <Row
          cells={[
            "Bombillo LED 12 W",
            "0,90",
            "2,10",
            pill("warning", "Categoría"),
          ]}
        />
        <Row
          cells={[
            "Cinta métrica 5 m",
            "1,20",
            "2,90",
            pill("success", "Válido"),
          ]}
        />
      </div>
      <div className="border-border bg-card mt-3 flex items-center justify-between gap-3 border p-3 text-xs">
        <span className="min-w-0">
          <span className="text-muted-foreground">
            «Iluminacion» se parece a{" "}
          </span>
          Ferretería
        </span>
        <span className="bg-foreground text-background px-2 py-1">Usar</span>
      </div>
    </MiniAppShell>
  );
}

// ── 02 Container read by AI ───────────────────────────────────────────────
function ContainerView() {
  return (
    <MiniAppShell
      active="DirectionsBoat"
      title="Contenedor MSKU 4829137"
      meta={pill("info", "En Tránsito")}
    >
      <div className="border-border bg-card mb-3 flex items-center gap-2 border p-3 text-xs">
        <Icons.SmartToy className="size-4 shrink-0" />
        <span className="min-w-0 truncate">
          packing-list-ningbo.pdf · 12 líneas leídas · 10 emparejadas
        </span>
      </div>
      <div className="border-border border">
        <Row
          head
          cells={["Del proveedor → tu catálogo", "Cant.", "Costo", "Match"]}
        />
        <Row
          cells={[
            "Aluminum cookware set → Juego de ollas x5",
            "240",
            "17,90",
            pill("success", "97 %"),
          ]}
        />
        <Row
          cells={[
            "LED bulb 12W E27 → Bombillo LED 12 W",
            "2400",
            "0,82",
            pill("success", "98 %"),
          ]}
        />
        <Row
          cells={[
            "Impact drill 650W → Taladro percutor",
            "120",
            "23,20",
            pill("success", "96 %"),
          ]}
        />
        <Row
          cells={[
            "Kitchen scale 5kg → (producto nuevo)",
            "180",
            "3,40",
            pill("warning", "Revisar"),
          ]}
        />
      </div>
    </MiniAppShell>
  );
}

// ── 03 Point of sale ──────────────────────────────────────────────────────
const TICKET = [
  ["Detergente líquido 2 L", 2, 3.9],
  ["Bolsas de basura 30 L x20", 3, 1.8],
  ["Bombillo LED 12 W", 4, 2.1],
] as const;

function PosView() {
  const total = TICKET.reduce((sum, [, qty, price]) => sum + qty * price, 0);
  return (
    <MiniAppShell
      active="PointOfSale"
      title="Punto de venta"
      meta={<RateChip />}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-border border">
          <div className="border-border bg-card flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
            <span className="truncate">Bodega La Esquina</span>
            <span className="text-muted-foreground font-mono">
              J-41234567-2
            </span>
          </div>
          {TICKET.map(([name, qty, price]) => (
            <div
              key={name}
              className="border-border flex items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0"
            >
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground font-mono">{qty}×</span>{" "}
                {name}
              </span>
              <span className="font-mono tabular-nums">
                {num.format(qty * price)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-border flex flex-col justify-between border p-3">
          <div>
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="font-mono text-2xl tabular-nums">{fmtUsd(total)}</p>
            <p className="text-muted-foreground font-mono text-xs tabular-nums">
              {fmtBs(total)}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <span className="bg-foreground text-background px-2 py-1.5 text-center">
              Pago móvil
            </span>
            <span className="border-border border px-2 py-1.5 text-center">
              Efectivo
            </span>
          </div>
        </div>
      </div>
    </MiniAppShell>
  );
}

// ── 04 Receivables ────────────────────────────────────────────────────────
function ReceivablesView() {
  return (
    <MiniAppShell active="RequestQuote" title="Cuentas por cobrar">
      <div className="mb-3 grid grid-cols-3 gap-3">
        <MiniStat label="Pendiente" value={fmtUsd(7240)} />
        <MiniStat label="Vencido" value={fmtUsd(2630.5)} />
        <MiniStat label="Cobrado (30 d)" value={fmtUsd(11480)} />
      </div>
      <div className="border-border border">
        <Row head cells={["Cliente", "Saldo", "Vence", "Estado"]} />
        <Row
          cells={[
            "Distribuidora Guacara",
            "2.140,00",
            "12/10",
            pill("warning", "Pendiente"),
          ]}
        />
        <Row
          cells={[
            "Ferretería El Tornillo",
            "1.310,50",
            "18/09",
            pill("destructive", "Vencida"),
          ]}
        />
        <Row
          cells={[
            "Supermercado San Diego",
            "860,00",
            "03/10",
            pill("orange", "Parcial"),
          ]}
        />
      </div>
    </MiniAppShell>
  );
}

export const STEP_VIEWS: Readonly<Record<StepId, () => React.JSX.Element>> = {
  catalogo: CatalogImportView,
  importacion: ContainerView,
  venta: PosView,
  cobranza: ReceivablesView,
};
