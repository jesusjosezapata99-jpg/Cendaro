"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import "./globals.css";

/**
 * Cendaro — Root error boundary.
 *
 * Replaces the root layout when it (or anything above the (app) layout)
 * throws, so it renders its own <html>/<body>. Errors inside the app layout
 * are handled by (app)/error.tsx; both report to Sentry.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center text-center">
          <h1 className="text-lg font-medium tracking-tight">Algo salió mal</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Ocurrió un error inesperado. Recarga la página o vuelve a intentarlo
            en unos minutos.
          </p>
          {error.digest ? (
            <p className="text-muted-foreground/60 mt-2 font-mono text-xs tabular-nums">
              Ref: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
