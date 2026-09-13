"use client";

import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "border-input data-[state=checked]:bg-tag data-[state=checked]:text-foreground focus-visible:border-ring peer size-4 shrink-0 border outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Icons.Check className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
