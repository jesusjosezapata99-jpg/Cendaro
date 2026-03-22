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

import { ScrollEntrance, StaggerGroup, StaggerItem } from "./scroll-entrance";

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

/* Mini-visual illustrations for each card */
function MiniVisual({ type }: { type: Feature["visual"] }) {
  const base = "mt-4 flex items-end gap-1";

  switch (type) {
    case "chart":
      return (
        <div className={base} aria-hidden="true">
          {[35, 55, 40, 70, 50, 85, 65, 80, 55, 90, 70, 75].map((h, i) => (
            <div
              key={i}
              className="bg-primary/15 group-hover:bg-primary/25 flex-1 rounded-t transition-colors duration-300"
              style={{ height: `${h * 0.5}px` }}
            />
          ))}
        </div>
      );
    case "stock":
      return (
        <div className="mt-4 space-y-1.5" aria-hidden="true">
          {[85, 42, 67].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`h-2 rounded-full transition-colors duration-300 ${
                  w > 60
                    ? "bg-emerald-500/30 group-hover:bg-emerald-500/50"
                    : "bg-amber-500/30 group-hover:bg-amber-500/50"
                }`}
                style={{ width: `${w}%` }}
              />
              <span className="text-muted-foreground/50 text-[9px] tabular-nums">
                {w}%
              </span>
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {["Creado", "Prep.", "Envío", "✓"].map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors duration-300 ${
                  i < 3
                    ? "bg-primary/30 group-hover:bg-primary/50"
                    : "bg-muted-foreground/10"
                }`}
              />
              <span className="text-muted-foreground/50 text-[8px]">{s}</span>
            </div>
          ))}
        </div>
      );
    case "users":
      return (
        <div className="mt-4 flex -space-x-2" aria-hidden="true">
          {[
            "bg-blue-500/30",
            "bg-emerald-500/30",
            "bg-amber-500/30",
            "bg-purple-500/30",
          ].map((c, i) => (
            <div
              key={i}
              className={`border-card text-muted-foreground/60 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[8px] font-bold ${c}`}
            >
              {String.fromCharCode(65 + i)}
            </div>
          ))}
          <div className="border-card bg-muted text-muted-foreground/60 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[8px]">
            +3
          </div>
        </div>
      );
    case "invoice":
      return (
        <div className="mt-4 space-y-1" aria-hidden="true">
          {[
            { label: "#001", status: "Pagada" },
            { label: "#002", status: "Pendiente" },
            { label: "#003", status: "Pagada" },
          ].map((inv) => (
            <div
              key={inv.label}
              className="bg-muted-foreground/5 flex items-center justify-between rounded px-2 py-1"
            >
              <span className="text-muted-foreground/50 text-[9px] tabular-nums">
                {inv.label}
              </span>
              <span
                className={`text-[8px] font-medium ${
                  inv.status === "Pagada"
                    ? "text-emerald-400/60"
                    : "text-amber-400/60"
                }`}
              >
                {inv.status}
              </span>
            </div>
          ))}
        </div>
      );
    case "analytics":
      return (
        <div className="mt-4 flex items-end gap-2" aria-hidden="true">
          <div className="flex flex-1 flex-col gap-0.5">
            {[80, 55, 95, 70].map((w, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className="bg-primary/20 group-hover:bg-primary/35 h-1.5 rounded-full transition-colors duration-300"
                  style={{ width: `${w}%` }}
                />
              </div>
            ))}
          </div>
          <div className="text-right">
            <div className="text-primary/60 text-[10px] font-bold">+24%</div>
            <div className="text-muted-foreground/40 text-[8px]">MoM</div>
          </div>
        </div>
      );
    case "ai":
      return (
        <div className="mt-4 flex flex-wrap gap-1" aria-hidden="true">
          {["Limpieza", "Hogar", "Textil", "Tech"].map((tag) => (
            <span
              key={tag}
              className="bg-primary/10 text-primary/60 group-hover:bg-primary/20 rounded-full px-2 py-0.5 text-[8px] font-medium transition-colors duration-300"
            >
              {tag}
            </span>
          ))}
        </div>
      );
    case "catalog":
      return (
        <div className="mt-4 grid grid-cols-3 gap-1" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted-foreground/5 group-hover:bg-muted-foreground/10 aspect-square rounded transition-colors duration-300"
            />
          ))}
        </div>
      );
  }
}

export function BentoGrid() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
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
              <div className="group border-border bg-card hover:border-muted-foreground/30 hover:shadow-primary/5 flex h-full flex-col rounded-(--radius-card) border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
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
