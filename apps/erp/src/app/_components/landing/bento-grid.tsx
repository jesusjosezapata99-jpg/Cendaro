import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Bot,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Users,
} from "lucide-react";

import { NoiseOverlay } from "./noise-overlay";
import { ScrollEntrance, StaggerGroup, StaggerItem } from "./scroll-entrance";
import { ScrollVideo } from "./scroll-video";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  span: number;
  visual:
    | "chart"
    | "stock"
    | "steps"
    | "users"
    | "invoice"
    | "analytics"
    | "ai"
    | "catalog";
}

const features: Feature[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Vista 360° de tu negocio en tiempo real",
    span: 2,
    visual: "chart",
  },
  {
    icon: Package,
    title: "Inventario",
    description: "Stock, movimientos y alertas automáticas",
    span: 1,
    visual: "stock",
  },
  {
    icon: ShoppingCart,
    title: "Pedidos",
    description: "Flujo completo de creación a entrega",
    span: 1,
    visual: "steps",
  },
  {
    icon: Users,
    title: "Proveedores",
    description: "Gestión centralizada de proveedores",
    span: 1,
    visual: "users",
  },
  {
    icon: Receipt,
    title: "Facturación",
    description: "Facturas, albaranes y cuentas por cobrar",
    span: 2,
    visual: "invoice",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Métricas que importan, insights accionables",
    span: 2,
    visual: "analytics",
  },
  {
    icon: Bot,
    title: "IA",
    description: "Categorización inteligente e importaciones",
    span: 1,
    visual: "ai",
  },
  {
    icon: BookOpen,
    title: "Catálogo",
    description: "Productos, precios y márgenes organizados",
    span: 1,
    visual: "catalog",
  },
];

/* Mini-visual illustrations for each card — enhanced */
function MiniVisual({ type }: { type: Feature["visual"] }) {
  switch (type) {
    case "chart":
      return (
        <div className="mt-4 overflow-hidden rounded-lg" aria-hidden="true">
          <ScrollVideo
            src="/videos/analytics-flow.mp4"
            className="w-full rounded-lg"
          />
        </div>
      );
    case "stock":
      return (
        <div className="mt-4 space-y-1.5" aria-hidden="true">
          {[
            { name: "Detergente 1L", pct: 85, color: "emerald" },
            { name: "Jabón Antibact.", pct: 42, color: "amber" },
            { name: "Cloro 2L", pct: 12, color: "red" },
          ].map((item) => (
            <div key={item.name}>
              <div className="text-muted-foreground/40 flex justify-between text-[10px]">
                <span>{item.name}</span>
                <span className="tabular-nums">{item.pct}%</span>
              </div>
              <div className="bg-muted-foreground/5 mt-0.5 h-1.5 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.color === "emerald"
                      ? "bg-emerald-500/40 group-hover:bg-emerald-500/60"
                      : item.color === "amber"
                        ? "bg-amber-500/40 group-hover:bg-amber-500/60"
                        : "bg-red-500/40 group-hover:bg-red-500/60"
                  }`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <div className="mt-4 flex items-center gap-1" aria-hidden="true">
          {[
            { label: "Nuevo", active: true, color: "bg-blue-500" },
            { label: "Prep.", active: true, color: "bg-amber-500" },
            { label: "Envío", active: true, color: "bg-violet-500" },
            { label: "✓", active: false, color: "bg-emerald-500" },
          ].map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                  s.active
                    ? `${s.color}/30 group-hover:${s.color}/50`
                    : "bg-muted-foreground/10"
                }`}
              />
              <span className="text-muted-foreground/50 text-[9px]">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      );
    case "users":
      return (
        <div className="mt-4" aria-hidden="true">
          <div className="flex -space-x-2">
            {[
              { initial: "A", color: "bg-blue-500/30", role: "Admin" },
              { initial: "M", color: "bg-emerald-500/30", role: "Vendedor" },
              { initial: "C", color: "bg-amber-500/30", role: "Almacén" },
              { initial: "R", color: "bg-purple-500/30", role: "Cobros" },
            ].map((u) => (
              <div
                key={u.initial}
                className={`border-card text-muted-foreground/60 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold ${u.color}`}
              >
                {u.initial}
              </div>
            ))}
            <div className="border-card bg-muted text-muted-foreground/60 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px]">
              +3
            </div>
          </div>
          <div className="text-muted-foreground/30 mt-1 flex gap-3 text-[9px]">
            <span>4 roles</span>
            <span>·</span>
            <span>7 usuarios</span>
          </div>
        </div>
      );
    case "invoice":
      return (
        <div className="mt-4 space-y-1" aria-hidden="true">
          {[
            {
              num: "#001",
              date: "22/03",
              amount: "$1,240",
              status: "Pagada",
              paid: true,
            },
            {
              num: "#002",
              date: "21/03",
              amount: "$980",
              status: "Pendiente",
              paid: false,
            },
            {
              num: "#003",
              date: "20/03",
              amount: "$540",
              status: "Pagada",
              paid: true,
            },
          ].map((inv) => (
            <div
              key={inv.num}
              className="bg-muted-foreground/5 flex items-center justify-between rounded px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/60 text-[11px] font-bold tabular-nums">
                  {inv.num}
                </span>
                <span className="text-muted-foreground/30 text-[10px] tabular-nums">
                  {inv.date}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground/50 text-[11px] font-medium tabular-nums">
                  {inv.amount}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    inv.paid
                      ? "bg-emerald-500/10 text-emerald-600/70"
                      : "bg-amber-500/10 text-amber-600/70"
                  }`}
                >
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    case "analytics":
      return (
        <div className="mt-4 flex items-end gap-3" aria-hidden="true">
          <div className="flex flex-1 flex-col gap-1">
            {[
              { label: "Ventas", pct: 80 },
              { label: "Cobros", pct: 55 },
              { label: "Margen", pct: 95 },
              { label: "Rotación", pct: 70 },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-1.5">
                <span className="text-muted-foreground/30 w-10 text-right text-[9px]">
                  {m.label}
                </span>
                <div className="flex-1">
                  <div
                    className="bg-primary/20 group-hover:bg-primary/35 h-1.5 rounded-full transition-colors duration-300"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
                <span className="text-muted-foreground/30 w-6 text-[9px] tabular-nums">
                  {m.pct}%
                </span>
              </div>
            ))}
          </div>
          <div className="text-right">
            <div className="text-primary/60 text-[12px] font-bold">+24%</div>
            <div className="text-muted-foreground/40 text-[10px]">MoM</div>
          </div>
        </div>
      );
    case "ai":
      return (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
          {["✨ Limpieza", "✨ Hogar", "✨ Textil", "✨ Tech"].map((tag) => (
            <span
              key={tag}
              className="bg-primary/10 text-primary/60 group-hover:bg-primary/20 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors duration-300"
            >
              {tag}
            </span>
          ))}
        </div>
      );
    case "catalog":
      return (
        <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
          {[
            { color: "bg-blue-500/15", price: "$4.50" },
            { color: "bg-emerald-500/15", price: "$2.80" },
            { color: "bg-violet-500/15", price: "$5.20" },
            { color: "bg-amber-500/15", price: "$3.10" },
            { color: "bg-cyan-500/15", price: "$1.90" },
            { color: "bg-rose-500/15", price: "$3.75" },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={`${item.color} aspect-square w-full rounded transition-opacity duration-300 group-hover:opacity-80`}
              />
              <span className="text-muted-foreground/30 text-[9px] tabular-nums">
                {item.price}
              </span>
            </div>
          ))}
        </div>
      );
  }
}

export function BentoGrid() {
  return (
    <section className="relative py-32">
      <NoiseOverlay opacity={0.025} />
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.12] tracking-[-0.02em]">
            Todo lo que necesitas
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">
            Un sistema completo para gestionar cada aspecto de tu negocio.
          </p>
        </ScrollEntrance>

        <StaggerGroup
          className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
          staggerDelay={0.06}
        >
          {features.map((feature) => (
            <StaggerItem
              key={feature.title}
              className={`${feature.span === 2 ? "lg:col-span-2" : ""}`}
            >
              <div className="group hover:shadow-primary/5 flex h-full flex-col rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.12)] hover:shadow-lg">
                <feature.icon
                  className="text-primary h-6 w-6"
                  strokeWidth={1.5}
                />
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {feature.description}
                </p>
                <MiniVisual type={feature.visual} />
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
