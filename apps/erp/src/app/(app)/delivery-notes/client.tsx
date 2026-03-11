"use client";

export default function DeliveryNotesClient() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Notas de Entrega
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Despacho y entrega de mercancía por orden de venta
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Pendientes",
            value: 0,
            icon: "local_shipping",
            accent: "border-amber-500/40",
          },
          {
            label: "En Tránsito",
            value: 0,
            icon: "flight_takeoff",
            accent: "border-blue-500/40",
          },
          {
            label: "Entregadas",
            value: 0,
            icon: "check_circle",
            accent: "border-emerald-500/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-4`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-[10px] font-bold tracking-widest uppercase">
              <th className="px-4 py-3">Nota #</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3">Despachado</th>
              <th className="px-4 py-3">Entregado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={5}
                className="text-muted-foreground px-4 py-12 text-center"
              >
                <span className="material-symbols-outlined mb-2 block text-3xl">
                  local_shipping
                </span>
                No hay notas de entrega registradas
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
