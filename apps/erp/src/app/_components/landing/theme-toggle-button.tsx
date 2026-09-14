"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Landing page theme toggle — a compact icon button that flips between
 * light and dark (the marketing site has no "system" affordance in its
 * navbar; that 3-state control lives in the authenticated app's
 * `ThemeSwitch`). Icon reflects the *resolved* theme so it always shows
 * what clicking it will switch away from.
 */
export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 cursor-pointer items-center justify-center transition-colors duration-200"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {isDark ? (
        <Sun className="h-4.5 w-4.5" strokeWidth={1.5} />
      ) : (
        <Moon className="h-4.5 w-4.5" strokeWidth={1.5} />
      )}
    </button>
  );
}
