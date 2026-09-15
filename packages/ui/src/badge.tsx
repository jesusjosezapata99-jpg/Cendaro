import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";

import { cn } from "@cendaro/ui";

const badgeVariants = cva(
  "focus-visible:border-ring inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap transition-colors focus-visible:ring-1 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a&]:hover:bg-primary/90 rounded-full border-transparent px-2 py-0.5 text-xs font-medium",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90 rounded-full border-transparent px-2 py-0.5 text-xs font-medium",
        destructive:
          "bg-destructive [a&]:hover:bg-destructive/90 rounded-full border-transparent px-2 py-0.5 text-xs font-medium text-white",
        outline:
          "text-primary rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-normal",
        tag: "text-tag-foreground bg-tag border-none px-2 py-0.5 text-[10px] font-normal",
        "tag-rounded":
          "text-tag-foreground bg-tag rounded-full border-none px-3 py-1 text-xs font-normal",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
