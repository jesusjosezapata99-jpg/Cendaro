import { cn } from "@cendaro/ui";

/** "Datos de ejemplo" caption: the recordings show the fictitious demo workspace (PRODUCT.md). */
export function SampleDataNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground font-mono text-xs tracking-wide",
        className,
      )}
    >
      Vista del producto con datos de ejemplo
    </p>
  );
}
