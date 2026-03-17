"use client";

/**
 * Step 1 — Mode Selection
 *
 * Replace vs Adjust vs Initialize mode selector with premium cards.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20, §23
 */
import type { ImportMode } from "@cendaro/api";

interface ModeSelectProps {
  selectedMode: ImportMode | null;
  onSelect: (mode: ImportMode) => void;
}

const modes: {
  value: ImportMode;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  badge?: { label: string; variant: "amber" | "emerald" | "sky" };
}[] = [
  {
    value: "replace",
    icon: "swap_horiz",
    title: "Reemplazar",
    subtitle: "Conteo Físico",
    description:
      "Sobrescribe el stock actual con las cantidades exactas del archivo.",
    bullets: [
      "Establece la cantidad exacta por SKU",
      "Ideal para conciliación post-conteo",
      "Requiere productos existentes en el catálogo",
    ],
    badge: { label: "Sobreescribe stock", variant: "amber" },
  },
  {
    value: "adjust",
    icon: "tune",
    title: "Ajustar",
    subtitle: "Ajuste Parcial",
    description:
      "Suma o resta cantidades al stock existente de forma incremental.",
    bullets: [
      "Valores positivos (+) agregan stock",
      "Valores negativos (−) restan stock",
      "No modifica productos sin cambios",
    ],
  },
  {
    value: "initialize",
    icon: "database",
    title: "Inicializar",
    subtitle: "Desde Cero",
    description:
      "Crea marcas, productos y stock en una sola operación desde el archivo.",
    bullets: [
      "Crea marcas automáticamente",
      "Registra productos nuevos con su SKU",
      "Establece el stock inicial por bultos",
    ],
    badge: { label: "Primera subida o reset", variant: "sky" },
  },
];

const badgeStyles = {
  amber:
    "bg-amber-500/10 text-amber-500 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20",
  emerald:
    "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  sky: "bg-sky-500/10 text-sky-500 ring-sky-500/20 dark:bg-sky-400/10 dark:text-sky-400 dark:ring-sky-400/20",
};

export function ModeSelect({ selectedMode, onSelect }: ModeSelectProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-foreground text-2xl font-black tracking-tight">
          Seleccionar Modo de Importación
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Elija cómo se aplicarán las cantidades del archivo al inventario
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        {modes.map((m) => {
          const isSelected = selectedMode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => onSelect(m.value)}
              className={`group relative flex cursor-pointer flex-col rounded-2xl border-2 p-0 text-left transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-primary/3 shadow-primary/10 ring-primary/20 shadow-lg ring-1"
                  : "border-border bg-card hover:border-primary/30 hover:bg-card/80 hover:shadow-md"
              }`}
            >
              {/* ── Top section: icon + title ─────── */}
              <div className="flex flex-col gap-3 px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
                      isSelected
                        ? "bg-primary shadow-primary/30 text-white shadow-md"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {m.icon}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="bg-primary flex size-6 items-center justify-center rounded-full shadow-sm">
                      <span className="material-symbols-outlined text-sm text-white">
                        check
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-foreground text-lg leading-tight font-bold">
                    {m.title}
                  </h3>
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {m.subtitle}
                  </span>
                </div>
              </div>

              {/* ── Divider ─────────────────────── */}
              <div className="border-border mx-5 border-t" />

              {/* ── Body: description + bullets ─── */}
              <div className="flex flex-1 flex-col gap-3 px-5 pt-3 pb-5">
                <p className="text-muted-foreground text-[13px] leading-relaxed">
                  {m.description}
                </p>

                <ul className="space-y-1.5">
                  {m.bullets.map((b) => (
                    <li
                      key={b}
                      className="text-muted-foreground flex items-start gap-2 text-xs"
                    >
                      <span
                        className={`material-symbols-outlined mt-px text-xs ${
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        check_circle
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* ── Badge (optional) ───────────── */}
                {m.badge && (
                  <div className="mt-auto pt-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${badgeStyles[m.badge.variant]}`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {m.badge.variant === "amber" ? "warning" : "info"}
                      </span>
                      {m.badge.label}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
