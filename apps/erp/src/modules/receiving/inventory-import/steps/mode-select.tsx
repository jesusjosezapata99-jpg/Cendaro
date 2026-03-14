"use client";

/**
 * Step 1 — Mode Selection
 *
 * Replace vs Adjust mode selector with descriptive cards.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20 (ModeSelected)
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
  description: string;
  warning?: string;
}[] = [
  {
    value: "replace",
    icon: "swap_horiz",
    title: "Reemplazar",
    description:
      "Establece la cantidad exacta del conteo físico. Sobrescribe el stock actual con el valor del archivo.",
    warning: "Reemplazar sobreescribe el stock actual",
  },
  {
    value: "adjust",
    icon: "tune",
    title: "Ajustar",
    description:
      "Suma o resta cantidades a lo existente. Use valores positivos para agregar y negativos para restar.",
  },
];

export function ModeSelect({ selectedMode, onSelect }: ModeSelectProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-bold">
          Seleccionar Modo de Importación
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Elija cómo se aplicarán las cantidades del archivo al inventario
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {modes.map((m) => {
          const isSelected = selectedMode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => onSelect(m.value)}
              className={`border-border bg-card group relative cursor-pointer rounded-xl border-2 p-6 text-left transition-all hover:shadow-md ${
                isSelected
                  ? "border-primary ring-primary/20 shadow-md ring-2"
                  : "hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`material-symbols-outlined rounded-lg p-2 text-2xl ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.icon}
                </span>
                <div className="flex-1">
                  <h3 className="text-foreground text-lg font-bold">
                    {m.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {m.description}
                  </p>
                </div>
              </div>

              {m.warning && (
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <span className="material-symbols-outlined text-sm">
                    warning
                  </span>
                  {m.warning}
                </div>
              )}

              {isSelected && (
                <div className="bg-primary absolute top-3 right-3 flex size-6 items-center justify-center rounded-full">
                  <span className="material-symbols-outlined text-sm text-white">
                    check
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
