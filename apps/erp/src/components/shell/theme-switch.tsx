"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import type { IconName } from "@cendaro/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cendaro/ui";
import { Icon } from "@cendaro/ui/icons";

const OPTIONS: {
  value: "system" | "light" | "dark";
  label: string;
  icon: IconName;
}[] = [
  { value: "system", label: "Sistema", icon: "DesktopWindows" },
  { value: "light", label: "Claro", icon: "LightMode" },
  { value: "dark", label: "Oscuro", icon: "DarkMode" },
];

/**
 * Theme switch — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1, Q15 (T2.8).
 * 3-state `Select` (Sistema/Claro/Oscuro); the trigger's own icon reflects
 * the *resolved* theme (system shows the desktop icon even while the OS is
 * dark, since that's the user's actual choice — light/dark show the theme
 * that's actually on screen).
 */
export function ThemeSwitch() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Hydration-safe placeholder: theme is unknown until mounted client-side.
  if (!mounted) {
    return <div className="bg-secondary h-8 w-28 animate-pulse" />;
  }

  const resolvedIcon: IconName =
    theme === "system"
      ? "DesktopWindows"
      : resolvedTheme === "dark"
        ? "DarkMode"
        : "LightMode";

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger size="sm" className="w-28 text-xs">
        <Icon name={resolvedIcon} className="size-3" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-xs"
          >
            <Icon name={option.icon} className="size-3" />
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
