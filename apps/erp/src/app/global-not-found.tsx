import Link from "next/link";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import {
  RootDocumentShell,
  sharedRootMetadata,
  sharedRootViewport,
} from "~/app/_components/root-shell";

export const metadata = sharedRootMetadata;
export const viewport = sharedRootViewport;

/**
 * Cendaro — Global Not Found (`experimental.globalNotFound: true`)
 *
 * Serves unmatched top-level routes across multi-root layouts (`(marketing)`,
 * `login`, `(app)`) while conforming to Cendaro 0-radius design rules.
 */
export default function GlobalNotFound() {
  return (
    <RootDocumentShell>
      <div className="bg-background flex min-h-screen w-full items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-card mb-6 flex size-12 items-center justify-center border">
            <Icons.Search className="text-muted-foreground size-5" />
          </div>

          <h1 className="text-foreground text-lg font-medium tracking-tight">
            404 — Página no encontrada
          </h1>

          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            La página solicitada no está disponible o ha cambiado de dirección.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" asChild className="gap-2">
              <Link href="/">
                <Icons.ArrowBack className="size-4" />
                Ir al inicio
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/funciones">Ver funciones</Link>
            </Button>
          </div>
        </div>
      </div>
    </RootDocumentShell>
  );
}
