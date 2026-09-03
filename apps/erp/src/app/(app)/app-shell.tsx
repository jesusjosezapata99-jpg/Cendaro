"use client";

import { Suspense, useEffect, useState } from "react";

import { Sidebar } from "~/components/sidebar";
import { TopBar } from "~/components/top-bar";
import { useWorkspace } from "~/hooks/use-workspace";

function PageSkeleton() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        <p className="text-muted-foreground text-xs">Cargando…</p>
      </div>
    </div>
  );
}

function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { isReady } = useWorkspace();

  // Hydration guard: the workspace id resolves client-side (cookie/localStorage
  // via WorkspaceAutoResolver) but is absent during SSR, so `isReady` diverges
  // on the first client render. Gate on mount so the first client render
  // matches the server output; React then reuses the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isReady) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground text-xs">
            Resolviendo workspace…
          </p>
        </div>
      </div>
    );
  }

  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <main className="bg-background safe-pb flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <WorkspaceGate>{children}</WorkspaceGate>
        </main>
      </div>
    </div>
  );
}
