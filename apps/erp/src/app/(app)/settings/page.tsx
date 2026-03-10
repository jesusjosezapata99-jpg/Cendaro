"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const DEFAULT_MODULES = [
  { key: "catalog", name: "Catálogo", icon: "inventory_2", defaultOn: true },
  { key: "inventory", name: "Inventario", icon: "factory", defaultOn: true },
  {
    key: "containers",
    name: "Contenedores",
    icon: "local_shipping",
    defaultOn: true,
  },
  { key: "pricing", name: "Pricing", icon: "sell", defaultOn: true },
  { key: "pos", name: "POS", icon: "shopping_cart", defaultOn: true },
  {
    key: "marketplace",
    name: "Mercado Libre",
    icon: "storefront",
    defaultOn: false,
  },
  { key: "whatsapp", name: "WhatsApp", icon: "chat", defaultOn: false },
  {
    key: "vendors",
    name: "Portal Vendedores",
    icon: "group",
    defaultOn: false,
  },
  { key: "audit", name: "Auditoría", icon: "policy", defaultOn: true },
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

export default function SettingsPage() {
  const trpc = useTRPC();
  const { data: profile, isLoading } = useQuery(trpc.users.me.queryOptions());

  // Org state initialized from server data
  const [orgName, setOrgName] = useState("");
  const [orgLegalName, setOrgLegalName] = useState("");
  const [orgRif, setOrgRif] = useState("");
  const [orgTimezone, setOrgTimezone] = useState("America/Caracas");

  const [modules, setModules] = useState(
    Object.fromEntries(DEFAULT_MODULES.map((m) => [m.key, m.defaultOn])),
  );
  const [pricingThreshold, setPricingThreshold] = useState("5");
  const [adminWindow, setAdminWindow] = useState("24");
  const [orgSaved, setOrgSaved] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);

  // Populate form when profile data arrives
  useEffect(() => {
    if (profile) {
      // Use profile data for display — org fields come from the organization table
      // For now, show email + role from the profile itself
      setOrgName(profile.fullName);
      setOrgLegalName(profile.email);
      setOrgRif("");
      setOrgTimezone("America/Caracas");
    }
  }, [profile]);

  const toggleModule = (key: string) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveOrg = () => {
    // TODO: Wire to tRPC mutation when organization CRUD router is added
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2000);
  };

  const handleSavePricing = () => {
    setPricingSaved(true);
    setTimeout(() => setPricingSaved(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-8 p-4 lg:p-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajustes de la organización, módulos y preferencias del sistema
        </p>
      </div>

      {/* Profile Info */}
      {profile && (
        <section className="border-primary/20 bg-primary/5 rounded-xl border p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full text-lg font-bold">
              {profile.fullName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold">{profile.fullName}</p>
              <p className="text-muted-foreground text-sm">
                {profile.email} ·{" "}
                <span className="capitalize">{profile.role}</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Organization */}
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Organización</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Datos de la empresa registrada en el sistema
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Nombre Comercial
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Razón Social
            </label>
            <input
              type="text"
              value={orgLegalName}
              onChange={(e) => setOrgLegalName(e.target.value)}
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">RIF</label>
            <input
              type="text"
              value={orgRif}
              onChange={(e) => setOrgRif(e.target.value)}
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Zona Horaria
            </label>
            <select
              value={orgTimezone}
              onChange={(e) => setOrgTimezone(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="America/Caracas">
                America/Caracas (VET -04:00)
              </option>
              <option value="America/Bogota">
                America/Bogota (COT -05:00)
              </option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSaveOrg}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
        >
          {orgSaved ? "✓ Guardado" : "Guardar Cambios"}
        </button>
      </section>

      {/* Modules */}
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Módulos</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Activa o desactiva módulos del sistema según las necesidades de tu
          operación
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_MODULES.map((mod) => (
            <button
              key={mod.key}
              onClick={() => toggleModule(mod.key)}
              className="border-border hover:bg-accent/30 flex items-center justify-between rounded-lg border p-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  {mod.icon}
                </span>
                <span className="text-sm font-medium">{mod.name}</span>
              </div>
              <div
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  modules[mod.key] ? "bg-primary" : "bg-muted"
                }`}
              >
                <div
                  className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${
                    modules[mod.key] ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Pricing Engine</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Configuración del motor de repricing automático
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Umbral BCV para auto-repricing (%)
            </label>
            <input
              type="number"
              value={pricingThreshold}
              onChange={(e) => setPricingThreshold(e.target.value)}
              min="1"
              max="50"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Si la tasa BCV sube este % o más, los precios se actualizan
              automáticamente
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Ventana de revisión admin (horas)
            </label>
            <input
              type="number"
              value={adminWindow}
              onChange={(e) => setAdminWindow(e.target.value)}
              min="1"
              max="72"
              className="border-border bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Tiempo para que admin revise/ratifique cambios automáticos
            </p>
          </div>
        </div>
        <button
          onClick={handleSavePricing}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
        >
          {pricingSaved ? "✓ Configuración Guardada" : "Guardar Configuración"}
        </button>
      </section>
    </div>
  );
}
