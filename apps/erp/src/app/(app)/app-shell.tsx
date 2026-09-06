"use client";

import { Suspense, useState } from "react";

import { Delayed } from "~/components/delayed";
import { Sidebar } from "~/components/sidebar";
import { TopBar } from "~/components/top-bar";
import { useWorkspace } from "~/hooks/use-workspace";

function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="space-y-2">
        <div className="bg-muted h-7 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted h-4 w-64 animate-pulse rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-4">
            <div className="bg-muted mb-2 h-3 w-20 animate-pulse rounded" />
            <div className="bg-muted h-6 w-16 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { isReady } = useWorkspace();

  // Workspace readiness derives from the cookie, which both the server
  // (layout.tsx) and the client read synchronously — so the first client
  // render always matches the SSR output and content renders immediately
  // on every normal load. The skeleton below only appears on a genuine
  // first-ever login (no cookie yet, WorkspaceAutoResolver still fetching)
  // and is delayed so quick resolutions never flash (NN/g guidance).
  if (!isReady) {
    return (
      <Delayed>
        <div className="flex h-full items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-muted-foreground text-xs">
              Preparando tu espacio…
            </p>
          </div>
        </div>
      </Delayed>
    );
  }

  return (
    <Suspense
      fallback={
        <Delayed>
          <PageSkeleton />
        </Delayed>
      }
    >
      {children}
    </Suspense>
  );
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
