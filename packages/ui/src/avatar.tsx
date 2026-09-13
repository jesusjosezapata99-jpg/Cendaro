"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "@cendaro/ui";

/** `variant="user"` → rounded-full (person avatars). `variant="workspace"` →
 * square with a border, matching Midday's workspace-switcher tiles (§5.9). */
function Avatar({
  className,
  variant = "user",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  variant?: "user" | "workspace";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden",
        variant === "user"
          ? "rounded-full"
          : "border-avatar-line rounded-none border",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted text-muted-foreground flex size-full items-center justify-center text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
