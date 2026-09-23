"use client";

/**
 * Step 1 — Mode Selection
 *
 * Replace vs Adjust vs Initialize mode selector with premium cards.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20, §23
 */
import type { ImportMode } from "@cendaro/api";
import type { IconName } from "@cendaro/ui/icons";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

interface ModeSelectProps {
  selectedMode: ImportMode | null;
  onSelect: (mode: ImportMode) => void;
  /** Initialize resets a whole warehouse: owner/admin only on the server. */
  canInitialize: boolean;
}

const modes: {
  value: ImportMode;
  icon: IconName;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  badge?: { label: string; variant: "amber" | "emerald" | "sky" };
}[] = [
  {
    value: "replace",
    icon: "SwapHoriz",
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
    icon: "Tune",
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
    icon: "Database",
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

export function ModeSelect({
  selectedMode,
  onSelect,
  canInitialize,
}: ModeSelectProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-foreground text-2xl font-medium tracking-tight">
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
          const isDisabled = m.value === "initialize" && !canInitialize;
          return (
            <button
              key={m.value}
              type="button"
              disabled={isDisabled}
              aria-disabled={isDisabled}
              onClick={() => onSelect(m.value)}
              className={`group relative flex flex-col border p-0 text-left transition-colors duration-200 ${
                isDisabled
                  ? "border-border bg-card cursor-not-allowed opacity-60"
                  : isSelected
                    ? "border-primary bg-primary/5 cursor-pointer"
                    : "border-border bg-card hover:border-primary/40 cursor-pointer"
              }`}
            >
              {/* ── Top section: icon + title ─────── */}
              <div className="flex flex-col gap-3 px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`flex size-10 items-center justify-center border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-muted text-muted-foreground group-hover:border-primary/40 group-hover:text-primary"
                    }`}
                  >
                    <Icon name={m.icon} className="size-5" />
                  </div>
                  {isSelected && (
                    <div className="bg-primary flex size-6 items-center justify-center rounded-full">
                      <Icons.Check className="size-3.5 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-foreground text-lg leading-tight font-medium">
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
                      <Icons.CheckCircle
                        className={`mt-px size-3 ${
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground/60"
                        }`}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* ── Badge (optional) ───────────── */}
                {m.badge && (
                  <div className="mt-auto pt-2">
                    <StatusPill
                      tone={m.badge.variant === "amber" ? "warning" : "info"}
                    >
                      {m.badge.label}
                    </StatusPill>
                  </div>
                )}

                {isDisabled && (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Icons.Lock className="size-3" />
                    Solo dueños y administradores
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
