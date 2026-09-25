"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

/**
 * Light/dark switch for the public site. The icon shows the theme a click
 * switches to; before mount a same-size placeholder avoids layout shift.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span aria-hidden="true" className={cn("size-11", className)} />;
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center transition-colors duration-(--motion-micro) outline-none focus-visible:ring-1",
        className,
      )}
    >
      {isDark ? (
        <Icons.LightMode className="size-5" />
      ) : (
        <Icons.DarkMode className="size-5" />
      )}
    </button>
  );
}
