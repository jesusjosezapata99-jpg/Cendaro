import { cn } from "@cendaro/ui";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground border-input min-h-15 w-full border bg-transparent px-3 py-2 text-sm outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
