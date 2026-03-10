"use client";

/**
 * Cendaro — Error Boundary
 *
 * Next.js error boundary for the (app) layout.
 * Catches unhandled errors in page components and provides
 * a user-friendly recovery UI instead of a white screen.
 */

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <span className="material-symbols-outlined text-3xl text-destructive">
            error
          </span>
        </div>

        <h2 className="text-xl font-bold text-foreground">
          Algo salió mal
        </h2>

        <p className="text-sm text-muted-foreground">
          {error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
        </p>

        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/60">
            Código: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
