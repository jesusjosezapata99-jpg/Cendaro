"use client";

import { Suspense, useState } from "react";

import { Sidebar } from "~/components/sidebar";
import { TopBar } from "~/components/top-bar";
import { TRPCProvider } from "~/trpc/client";

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <TRPCProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
          <main className="bg-background safe-pb flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
          </main>
        </div>
      </div>
    </TRPCProvider>
  );
}
