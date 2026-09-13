"use client";

import { Suspense, useState } from "react";

import { Delayed } from "~/components/delayed";
import { Header } from "~/components/shell/header";
import { MobileMenu } from "~/components/shell/mobile-menu";
import { Rail } from "~/components/shell/rail";
import { useCurrentUser } from "~/hooks/use-current-user";
import { useWorkspace } from "~/hooks/use-workspace";

function PageSkeleton() {
  return (
    <div className="space-y-6 py-4 lg:py-8">
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

/**
 * PLAN-2026-09-MIDDAY-REDESIGN §5.8.1, T2.9 — the real shell swap: `Sidebar`
 * + `TopBar` (F1-era) are replaced by `Rail` + `Header` + `MobileMenu`
 * (T2.1–T2.8, all built and gated individually this session, none wired
 * until now). Content column offsets by the rail's collapsed width
 * (`md:ml-17.5` = 70px) and supplies its own horizontal padding
 * (`px-4 md:px-8`) — pages no longer do (see
 * `scripts/codemods/strip-page-horizontal-padding.mjs`, run once as part of
 * this task to avoid doubling it up across all 27 routes).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { profile } = useCurrentUser();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Rail />
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        role={profile?.role ?? null}
      />
      <div className="flex flex-1 flex-col overflow-hidden md:ml-17.5">
        <Header onToggleMobileMenu={() => setMobileMenuOpen((o) => !o)} />
        <main className="bg-background safe-pb flex-1 overflow-y-auto overscroll-contain px-4 [-webkit-overflow-scrolling:touch] md:px-8">
          <WorkspaceGate>{children}</WorkspaceGate>
        </main>
      </div>
    </div>
  );
}
