"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Icons } from "@cendaro/ui/icons";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid hydration mismatch — render placeholder with same dimensions
    return (
      <button
        className="bg-secondary text-muted-foreground flex size-9 items-center justify-center rounded-lg"
        aria-label="Toggle theme"
      >
        <Icons.LightMode className="size-5" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center rounded-lg transition-colors"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {isDark ? (
        <Icons.LightMode className="size-5" />
      ) : (
        <Icons.DarkMode className="size-5" />
      )}
    </button>
  );
}
