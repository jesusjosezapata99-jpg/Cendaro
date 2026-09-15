"use client";

import Link from "next/link";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

/**
 * Cendaro — App Error Boundary (Cendaro Spec M-Error)
 *
 * Catches unhandled runtime exceptions inside the app layout.
 * Conforms to Cendaro design rules:
 * - Title: text-lg font-medium
 * - Description: text-sm text-muted-foreground
 * - Buttons: outline styling
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-[calc(100vh-8rem)] w-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="border-border bg-card mb-6 flex size-12 items-center justify-center border">
          <Icons.Warning className="text-muted-foreground size-5" />
        </div>

        <h2 className="text-foreground text-lg font-medium tracking-tight">
          Algo salió mal
        </h2>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {error.message ||
            "Ocurrió un error inesperado al procesar la solicitud. Intenta de nuevo o regresa al panel principal."}
        </p>

        {error.digest ? (
          <p className="text-muted-foreground/60 mt-2 font-mono text-xs tabular-nums">
            Ref: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <Button variant="outline" onClick={reset} className="gap-2">
            <Icons.Refresh className="size-4" />
            Intentar de nuevo
          </Button>

          <Button variant="outline" asChild>
            <Link href="/dashboard">Ir al Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
