"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { WidgetId } from "@cendaro/validators";
import { cn } from "@cendaro/ui";
import { Icon } from "@cendaro/ui/icons";

import { WIDGET_TITLES } from "./widget-order";

interface SortableWidgetProps {
  id: WidgetId;
  isCustomizing: boolean;
  isHidden: boolean;
  onToggleVisibility: (id: WidgetId) => void;
  children: React.ReactNode;
}

/**
 * Sortable widget container for the modular dashboard grid.
 * (PLAN-2026-09-DESIGN-SYSTEM §T3.4)
 *
 * In customize mode:
 * - Drag handle with `DragIndicator` icon (`{...attributes} {...listeners}`).
 * - Visibility toggle button with `Visibility` / `VisibilityOff` icon.
 * - Keyboard accessible via `@dnd-kit/core`'s `KeyboardSensor`.
 * - Visual cue for hidden widgets (`opacity-50 border-dashed`).
 * - Disables pointer events on internal links/buttons so dragging never triggers navigation.
 */
export function SortableWidget({
  id,
  isCustomizing,
  isHidden,
  onToggleVisibility,
  children,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !isCustomizing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const title = WIDGET_TITLES[id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative transition-opacity",
        isDragging && "ring-border z-30 opacity-50 ring-1",
        isCustomizing && isHidden && "border-dashed opacity-50",
      )}
    >
      {/* Top action controls in customization mode */}
      {isCustomizing ? (
        <div className="animate-in fade-in absolute top-3 right-3 z-20 flex items-center gap-1.5 duration-150">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(id);
            }}
            className={cn(
              "border-border bg-background flex size-6 items-center justify-center border transition-colors",
              isHidden
                ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                : "text-foreground hover:bg-accent",
            )}
            title={isHidden ? "Mostrar widget" : "Ocultar widget"}
            aria-label={isHidden ? `Mostrar ${title}` : `Ocultar ${title}`}
          >
            <Icon
              name={isHidden ? "VisibilityOff" : "Visibility"}
              className="size-3.5"
            />
          </button>

          <button
            type="button"
            {...attributes}
            {...listeners}
            className="border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex size-6 cursor-grab items-center justify-center border transition-colors focus-visible:ring-1 active:cursor-grabbing"
            title="Arrastrar para reordenar"
            aria-label={`Reordenar ${title}`}
          >
            <Icon name="DragIndicator" className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Hidden badge in customization mode */}
      {isCustomizing && isHidden ? (
        <div className="pointer-events-none absolute right-3 bottom-3 z-10">
          <span className="border-border bg-accent text-muted-foreground border px-1.5 py-0.5 text-[10px] font-medium">
            Oculto
          </span>
        </div>
      ) : null}

      {/* Widget content: pointer events disabled while customizing to prevent accidental clicks */}
      <div
        className={cn(
          "h-full",
          isCustomizing && "pointer-events-none select-none",
        )}
      >
        {children}
      </div>
    </div>
  );
}
