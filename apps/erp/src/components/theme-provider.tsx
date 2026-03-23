"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="cendaro-theme"
      themes={["light", "dark"]}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
