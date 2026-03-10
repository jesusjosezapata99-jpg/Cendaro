import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Punto de Venta — Cendaro",
};

export default function POSPage() {
  return (
    <div className="flex h-[calc(100vh-2rem)] items-center justify-center p-4">
      <div className="border-border bg-card flex max-w-lg flex-col items-center rounded-2xl border p-12 text-center shadow-lg">
        <div className="bg-primary/10 mb-6 flex size-20 items-center justify-center rounded-2xl">
          <span className="material-symbols-outlined text-primary text-4xl">
            point_of_sale
          </span>
        </div>
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Punto de Venta
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Módulo en desarrollo — Fase 4 del roadmap estratégico
        </p>
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-medium text-amber-400">
            <span className="material-symbols-outlined mr-1 align-middle text-sm">
              construction
            </span>
            Este módulo se activará cuando se complete la integración del POS
            con el motor de inventario y pagos.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-6 text-center">
          <div>
            <span className="material-symbols-outlined text-muted-foreground text-2xl">
              barcode_scanner
            </span>
            <p className="text-muted-foreground mt-1 text-xs">
              Escaneo de código
            </p>
          </div>
          <div>
            <span className="material-symbols-outlined text-muted-foreground text-2xl">
              payments
            </span>
            <p className="text-muted-foreground mt-1 text-xs">Multi-método</p>
          </div>
          <div>
            <span className="material-symbols-outlined text-muted-foreground text-2xl">
              receipt
            </span>
            <p className="text-muted-foreground mt-1 text-xs">Facturación</p>
          </div>
        </div>
      </div>
    </div>
  );
}
