/**
 * Keyboard-shortcut hints for the search palette (T2.12).
 * Pure presentational — no state, extracted so `search-modal.tsx` stays
 * focused on the Dialog/M-19 sizing and `search.tsx` on data + navigation.
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-secondary rounded border px-1 py-0.5 font-mono">
      {children}
    </kbd>
  );
}

export function SearchFooter() {
  return (
    <div className="border-border flex items-center justify-between border-t px-4 py-2">
      <div className="text-muted-foreground/50 flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          navegar
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd>
          seleccionar
        </span>
        <span className="flex items-center gap-1">
          <Kbd>ESC</Kbd>
          cerrar
        </span>
      </div>
    </div>
  );
}
