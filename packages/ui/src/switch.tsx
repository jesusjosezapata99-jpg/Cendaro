"use client";

import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@cendaro/ui";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "focus-visible:border-ring data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-6 w-11 shrink-0 items-center transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background pointer-events-none block size-5 translate-x-0.5 transition-transform data-[state=checked]:translate-x-[22px]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
