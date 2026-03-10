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
        <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-2xl">
          <span className="material-symbols-outlined text-destructive text-3xl">
            error
          </span>
        </div>

        <h2 className="text-foreground text-xl font-bold">Algo salió mal</h2>

        <p className="text-muted-foreground text-sm">
          {error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
        </p>

        {error.digest && (
          <p className="text-muted-foreground/60 font-mono text-xs">
            Código: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
