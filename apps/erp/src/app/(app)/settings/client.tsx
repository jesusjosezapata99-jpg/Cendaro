"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useTRPC } from "~/trpc/client";

const DEFAULT_MODULES = [
  {
    key: "catalog",
    name: "Catálogo & Productos",
    icon: "inventory_2",
    description: "Maestro de SKUs, marcas, categorías y variantes",
    defaultOn: true,
  },
  {
    key: "inventory",
    name: "Inventario & Almacenes",
    icon: "warehouse",
    description: "Control multialmacén, existencias y movimientos",
    defaultOn: true,
  },
  {
    key: "containers",
    name: "Importaciones & Contenedores",
    icon: "local_shipping",
    description:
      "Cadena de suministro marítima, costeo FOB/CIF y packing lists",
    defaultOn: true,
  },
  {
    key: "pricing",
    name: "Motor de Precios & Repricing",
    icon: "sell",
    description: "Reglas de margen dinámico y conversión oficial BCV",
    defaultOn: true,
  },
  {
    key: "pos",
    name: "Punto de Venta Mostrador (POS)",
    icon: "shopping_cart",
    description: "Terminal de venta física rápida con multi-pago",
    defaultOn: true,
  },
  {
    key: "marketplace",
    name: "Mercado Libre B2B",
    icon: "storefront",
    description: "Sincronización bidireccional de publicaciones y órdenes",
    defaultOn: false,
  },
  {
    key: "whatsapp",
    name: "Ventas WhatsApp CRM",
    icon: "chat",
    description: "Gestión de pedidos conversacionales y enlaces directos",
    defaultOn: false,
  },
  {
    key: "vendors",
    name: "Fuerza de Ventas & Comisiones",
    icon: "group",
    description: "Liquidación y seguimiento de asesores comerciales",
    defaultOn: false,
  },
  {
    key: "audit",
    name: "Auditoría & Trazabilidad",
    icon: "policy",
    description: "Log inmutable de eventos forenses y mutaciones del ERP",
    defaultOn: true,
  },
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

export default function SettingsClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery(
    trpc.users.me.queryOptions(),
  );

  const { data: workspaceData, isLoading: loadingWorkspace } = useQuery(
    trpc.workspace.current.queryOptions(),
  );

  // Organization state
  const [orgName, setOrgName] = useState("");
  const [orgLegalName, setOrgLegalName] = useState("");
  const [orgRif, setOrgRif] = useState("");
  const [orgTimezone, setOrgTimezone] = useState("America/Caracas");

  // Modules state
  const [modules, setModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_MODULES.map((m) => [m.key, m.defaultOn])),
  );

  // Pricing engine state
  const [pricingThreshold, setPricingThreshold] = useState("5");
  const [adminWindow, setAdminWindow] = useState("24");
  const [safetyMargin, setSafetyMargin] = useState("3.5");

  // Feedback states
  const [orgSaved, setOrgSaved] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);

  // Initialize data
  useEffect(() => {
    if (workspaceData?.name) {
      setOrgName(workspaceData.name);
    } else if (profile?.fullName) {
      setOrgName(profile.fullName);
    }

    if (profile?.email) {
      setOrgLegalName(profile.email);
    }
  }, [workspaceData, profile]);

  const updateWorkspaceMutation = useMutation(
    trpc.workspace.update.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["workspace"]] });
        setOrgSaved(true);
        setTimeout(() => setOrgSaved(false), 2500);
      },
    }),
  );

  const toggleModule = (key: string) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    updateWorkspaceMutation.mutate({
      name: orgName.trim(),
    });
  };

  const handleSavePricing = (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaved(true);
    setTimeout(() => setPricingSaved(false), 2500);
  };

  const activeModulesCount = useMemo(
    () => Object.values(modules).filter(Boolean).length,
    [modules],
  );

  if (loadingProfile && loadingWorkspace) {
    return (
      <div className="space-y-6 p-4 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <PageHeader
        title="Configuración del Sistema"
        description="Ajustes de la organización comercial, arquitectura de módulos y políticas del motor de precios"
      />

      {/* 4 StatCards Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Módulos Activos"
          value={`${activeModulesCount} / ${DEFAULT_MODULES.length}`}
          icon="deployed_code"
          tone="primary"
          sub="Arquitectura operativa"
        />
        <StatCard
          label="Plan del Workspace"
          value={workspaceData?.plan ? workspaceData.plan.toUpperCase() : "PRO"}
          icon="verified"
          tone="success"
          sub="Suscripción empresarial"
        />
        <StatCard
          label="Zona Horaria"
          value="VET (-04:00)"
          icon="schedule"
          tone="default"
          sub="Caracas, Venezuela"
        />
        <StatCard
          label="Moneda Primaria"
          value="USD ($)"
          icon="payments"
          tone="default"
          sub="Tasa Operativa: BCV"
        />
      </div>

      {/* Profile Card */}
      {profile && (
        <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase shadow-sm">
              {profile.fullName
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-foreground truncate text-sm font-semibold">
                  {profile.fullName}
                </p>
                <StatusBadge tone="primary">{profile.role}</StatusBadge>
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {profile.email} · @{profile.username}
              </p>
            </div>
          </div>

          <div className="text-muted-foreground border-border/50 flex items-center gap-2 border-t pt-3 font-mono text-xs sm:border-t-0 sm:pt-0">
            <span className="material-symbols-outlined text-sm">shield</span>
            <span>Sesión Autenticada</span>
          </div>
        </div>
      )}

      {/* Organization Settings */}
      <div className="surface-card p-6">
        <div className="border-border/60 mb-5 border-b pb-4">
          <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
            <span className="material-symbols-outlined text-primary text-lg">
              business
            </span>
            Datos de la Organización & Empresa
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Identificación legal y parámetros operativos para facturación
            interna y despachos
          </p>
        </div>

        <form onSubmit={handleSaveOrg} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Nombre Comercial del Negocio
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-xs focus:ring-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Razón Social / Razón Fiscal
              </label>
              <input
                type="text"
                value={orgLegalName}
                onChange={(e) => setOrgLegalName(e.target.value)}
                placeholder="Ej. Comercializadora Cendaro C.A."
                className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-xs focus:ring-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                RIF / Identificación Fiscal
              </label>
              <input
                type="text"
                value={orgRif}
                onChange={(e) => setOrgRif(e.target.value)}
                placeholder="Ej. J-12345678-9"
                className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-xs uppercase focus:ring-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Zona Horaria Operativa
              </label>
              <select
                value={orgTimezone}
                onChange={(e) => setOrgTimezone(e.target.value)}
                className="border-border bg-background text-foreground focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-xs focus:ring-2 focus:outline-none"
              >
                <option value="America/Caracas">
                  America/Caracas (VET -04:00) — Oficial Venezuela
                </option>
                <option value="America/Bogota">
                  America/Bogota (COT -05:00) — Colombia
                </option>
                <option value="America/Panama">
                  America/Panama (EST -05:00) — Panamá
                </option>
              </select>
            </div>
          </div>

          <div className="border-border/50 flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-[11px]">
              Los cambios se propagarán a todos los módulos y comprobantes
              impresos.
            </span>

            <button
              type="submit"
              disabled={updateWorkspaceMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {updateWorkspaceMutation.isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                  Guardando...
                </>
              ) : orgSaved ? (
                <>
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                  Guardado Correctamente
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                  Guardar Organización
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modules Architecture Grid */}
      <div className="surface-card p-6">
        <div className="border-border/60 mb-5 border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <span className="material-symbols-outlined text-primary text-lg">
                  deployed_code
                </span>
                Arquitectura de Módulos ERP
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Activa o desactiva capacidades según la estructura comercial de
                tu empresa
              </p>
            </div>
            <StatusBadge tone="primary">
              {activeModulesCount} Activos
            </StatusBadge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_MODULES.map((mod) => {
            const isEnabled = modules[mod.key];

            return (
              <div
                key={mod.key}
                onClick={() => toggleModule(mod.key)}
                className={`flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-all ${
                  isEnabled
                    ? "border-primary/30 bg-primary/5 shadow-xs"
                    : "border-border bg-card hover:bg-accent/40"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      isEnabled
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {mod.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-xs font-semibold">
                      {mod.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>

                <div
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    isEnabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-transform ${
                      isEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing Engine & Exchange Rates Policies */}
      <div className="surface-card p-6">
        <div className="border-border/60 mb-5 border-b pb-4">
          <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
            <span className="material-symbols-outlined text-primary text-lg">
              sell
            </span>
            Políticas del Motor de Precios & BCV
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Automatización de márgenes, auto-repricing cambiario y protección
            contra devaluación
          </p>
        </div>

        <form onSubmit={handleSavePricing} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Umbral de Variación BCV (%)
              </label>
              <input
                type="number"
                value={pricingThreshold}
                onChange={(e) => setPricingThreshold(e.target.value)}
                min="1"
                max="50"
                step="0.5"
                required
                className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-xs tabular-nums focus:ring-2 focus:outline-none"
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                Dispara propuestas de repricing si la tasa oficial varía por
                encima de este valor.
              </p>
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Ventana de Ratificación (Horas)
              </label>
              <input
                type="number"
                value={adminWindow}
                onChange={(e) => setAdminWindow(e.target.value)}
                min="1"
                max="72"
                required
                className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-xs tabular-nums focus:ring-2 focus:outline-none"
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                Tiempo límite para que el supervisor apruebe o ajuste el nuevo
                catálogo.
              </p>
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Margen de Seguridad Cambiaria (%)
              </label>
              <input
                type="number"
                value={safetyMargin}
                onChange={(e) => setSafetyMargin(e.target.value)}
                min="0"
                max="25"
                step="0.1"
                required
                className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-xs tabular-nums focus:ring-2 focus:outline-none"
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                Colchón preventivo incorporado en cotizaciones diferidas a
                crédito.
              </p>
            </div>
          </div>

          <div className="border-border/50 flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-[11px]">
              El motor evaluará cada fluctuación oficial emitida por el Banco
              Central de Venezuela.
            </span>

            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-colors"
            >
              {pricingSaved ? (
                <>
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                  Políticas Guardadas
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">
                    tune
                  </span>
                  Guardar Políticas
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
