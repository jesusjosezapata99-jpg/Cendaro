"use client";

import { useState } from "react";

const DEFAULT_ORG = {
  name: "Mi Empresa C.A.",
  legalName: "Mi Empresa Comercial, C.A.",
  rif: "J-12345678-9",
  timezone: "America/Caracas",
};

const DEFAULT_MODULES = [
  { key: "catalog", name: "Catálogo", icon: "inventory_2", defaultOn: true },
  { key: "inventory", name: "Inventario", icon: "factory", defaultOn: true },
  { key: "containers", name: "Contenedores", icon: "local_shipping", defaultOn: true },
  { key: "pricing", name: "Pricing", icon: "sell", defaultOn: true },
  { key: "pos", name: "POS", icon: "shopping_cart", defaultOn: true },
  { key: "marketplace", name: "Mercado Libre", icon: "storefront", defaultOn: false },
  { key: "whatsapp", name: "WhatsApp", icon: "chat", defaultOn: false },
  { key: "vendors", name: "Portal Vendedores", icon: "group", defaultOn: false },
  { key: "audit", name: "Auditoría", icon: "policy", defaultOn: true },
];

export default function SettingsPage() {
  const [org, setOrg] = useState(DEFAULT_ORG);
  const [modules, setModules] = useState(
    Object.fromEntries(DEFAULT_MODULES.map((m) => [m.key, m.defaultOn])),
  );
  const [pricingThreshold, setPricingThreshold] = useState("5");
  const [adminWindow, setAdminWindow] = useState("24");
  const [orgSaved, setOrgSaved] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);

  const toggleModule = (key: string) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveOrg = () => {
    // In production this would call a tRPC mutation
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2000);
  };

  const handleSavePricing = () => {
    setPricingSaved(true);
    setTimeout(() => setPricingSaved(false), 2000);
  };

  return (
    <div className="p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajustes de la organización, módulos y preferencias del sistema
        </p>
      </div>

      {/* Organization */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Organización</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Datos de la empresa registrada en el sistema
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nombre Comercial</label>
            <input
              type="text"
              value={org.name}
              onChange={(e) => setOrg((o) => ({ ...o, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Razón Social</label>
            <input
              type="text"
              value={org.legalName}
              onChange={(e) => setOrg((o) => ({ ...o, legalName: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">RIF</label>
            <input
              type="text"
              value={org.rif}
              onChange={(e) => setOrg((o) => ({ ...o, rif: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Zona Horaria</label>
            <select
              value={org.timezone}
              onChange={(e) => setOrg((o) => ({ ...o, timezone: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="America/Caracas">America/Caracas (VET -04:00)</option>
              <option value="America/Bogota">America/Bogota (COT -05:00)</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSaveOrg}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {orgSaved ? "✓ Guardado" : "Guardar Cambios"}
        </button>
      </section>

      {/* Modules */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Módulos</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Activa o desactiva módulos del sistema según las necesidades de tu operación
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_MODULES.map((mod) => (
            <button
              key={mod.key}
              onClick={() => toggleModule(mod.key)}
              className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-muted-foreground">{mod.icon}</span>
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
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Pricing Engine</h2>
        <p className="mb-4 text-sm text-muted-foreground">
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si la tasa BCV sube este % o más, los precios se actualizan automáticamente
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tiempo para que admin revise/ratifique cambios automáticos
            </p>
          </div>
        </div>
        <button
          onClick={handleSavePricing}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {pricingSaved ? "✓ Configuración Guardada" : "Guardar Configuración"}
        </button>
      </section>
    </div>
  );
}
