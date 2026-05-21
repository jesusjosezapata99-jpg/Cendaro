import { Suspense } from "react";
import { cookies } from "next/headers";

import { WORKSPACE_COOKIE } from "~/hooks/use-workspace";
import { AppShell } from "./app-shell";
import { Providers } from "./providers";

async function WorkspaceLoader({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  return (
    <Providers initialWorkspaceId={workspaceId}>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <WorkspaceLoader>{children}</WorkspaceLoader>
    </Suspense>
  );
}
