"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

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
        <span className="material-symbols-outlined text-xl">light_mode</span>
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
      <span className="material-symbols-outlined text-xl">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
