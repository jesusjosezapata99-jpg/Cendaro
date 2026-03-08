import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Punto de Venta — Cendaro",
};

export default function POSPage() {
  return (
    <div className="flex h-[calc(100vh-2rem)] items-center justify-center p-4">
      <div className="flex max-w-lg flex-col items-center rounded-2xl border border-border bg-card p-12 text-center shadow-lg">
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary/10">
          <span className="material-symbols-outlined text-4xl text-primary">point_of_sale</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Punto de Venta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Módulo en desarrollo — Fase 4 del roadmap estratégico
        </p>
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-medium text-amber-400">
            <span className="material-symbols-outlined mr-1 align-middle text-sm">construction</span>
            Este módulo se activará cuando se complete la integración del POS con el motor de inventario y pagos.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-6 text-center">
          <div>
            <span className="material-symbols-outlined text-2xl text-muted-foreground">barcode_scanner</span>
            <p className="mt-1 text-xs text-muted-foreground">Escaneo de código</p>
          </div>
          <div>
            <span className="material-symbols-outlined text-2xl text-muted-foreground">payments</span>
            <p className="mt-1 text-xs text-muted-foreground">Multi-método</p>
          </div>
          <div>
            <span className="material-symbols-outlined text-2xl text-muted-foreground">receipt</span>
            <p className="mt-1 text-xs text-muted-foreground">Facturación</p>
          </div>
        </div>
      </div>
    </div>
  );
}
