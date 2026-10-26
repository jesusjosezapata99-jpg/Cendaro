"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { IconName } from "@cendaro/ui/icons";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useTRPC } from "~/trpc/client";

const DEFAULT_MODULES: {
  key: string;
  name: string;
  icon: IconName;
  description: string;
  defaultOn: boolean;
}[] = [
  {
    key: "catalog",
    name: "Catálogo & Productos",
    icon: "Inventory2",
    description: "Maestro de SKUs, marcas, categorías y variantes",
    defaultOn: true,
  },
  {
    key: "inventory",
    name: "Inventario & Almacenes",
    icon: "Warehouse",
    description: "Control multialmacén, existencias y movimientos",
    defaultOn: true,
  },
  {
    key: "containers",
    name: "Importaciones & Contenedores",
    icon: "LocalShipping",
    description:
      "Cadena de suministro marítima, costeo FOB/CIF y packing lists",
    defaultOn: true,
  },
  {
    key: "pricing",
    name: "Motor de Precios & Repricing",
    icon: "Sell",
    description: "Reglas de margen dinámico y conversión oficial BCV",
    defaultOn: true,
  },
  {
    key: "pos",
    name: "Punto de Venta Mostrador (POS)",
    icon: "ShoppingCart",
    description: "Terminal de venta física rápida con multi-pago",
    defaultOn: true,
  },
  {
    key: "marketplace",
    name: "Mercado Libre B2B",
    icon: "Storefront",
    description: "Sincronización bidireccional de publicaciones y órdenes",
    defaultOn: false,
  },
  {
    key: "whatsapp",
    name: "Ventas WhatsApp CRM",
    icon: "Chat",
    description: "Gestión de pedidos conversacionales y enlaces directos",
    defaultOn: false,
  },
  {
    key: "vendors",
    name: "Fuerza de Ventas & Comisiones",
    icon: "Group",
    description: "Liquidación y seguimiento de asesores comerciales",
    defaultOn: false,
  },
  {
    key: "audit",
    name: "Auditoría & Trazabilidad",
    icon: "Policy",
    description: "Log inmutable de eventos forenses y mutaciones del ERP",
    defaultOn: true,
  },
];

export default function SettingsClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery(
    trpc.users.me.queryOptions(),
  );

  const { data: workspaceData, isLoading: loadingWorkspace } = useQuery(
    trpc.workspace.current.queryOptions(),
  );

  const { data: pendingInvitations, refetch: refetchInvitations } = useQuery(
    trpc.workspace.invitations.queryOptions(),
  );

  // Multi-Legal Entity & Multi-Branch (F11.2)
  const { data: legalEntities, refetch: refetchLegalEntities } = useQuery(
    trpc.fiscal.listLegalEntities.queryOptions(),
  );
  const { data: branches, refetch: refetchBranches } = useQuery(
    trpc.fiscal.listBranches.queryOptions(),
  );

  const [newEntityRif, setNewEntityRif] = useState("");
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityAddress, setNewEntityAddress] = useState("");
  const [newBranchCode, setNewBranchCode] = useState("SUC-01");
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchSeries, setNewBranchSeries] = useState("A");
  const [selectedEntityForBranch, setSelectedEntityForBranch] = useState("");

  const saveLegalEntityMutation = useMutation(
    trpc.fiscal.saveLegalEntity.mutationOptions({
      onSuccess: () => {
        toast.success("Entidad legal / RIF registrada");
        setNewEntityRif("");
        setNewEntityName("");
        setNewEntityAddress("");
        void refetchLegalEntities();
      },
      onError: (err) => {
        toast.error(err.message || "Error al guardar entidad legal");
      },
    }),
  );

  const saveBranchMutation = useMutation(
    trpc.fiscal.saveBranch.mutationOptions({
      onSuccess: () => {
        toast.success("Sucursal y serie de facturación registrada");
        setNewBranchName("");
        void refetchBranches();
      },
      onError: (err) => {
        toast.error(err.message || "Error al guardar sucursal");
      },
    }),
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

    if (workspaceData?.profile?.legalName) {
      setOrgLegalName(workspaceData.profile.legalName);
    }
    if (workspaceData?.profile?.taxId) {
      setOrgRif(workspaceData.profile.taxId);
    }

    if (workspaceData?.modules) {
      const enabledSet = new Set<string>(workspaceData.modules);
      setModules(
        Object.fromEntries(
          DEFAULT_MODULES.map((m) => [
            m.key,
            enabledSet.has(m.key) || m.defaultOn,
          ]),
        ),
      );
    }

    if (workspaceData?.pricingPolicy) {
      const cond = workspaceData.pricingPolicy.conditions as {
        pricingThreshold?: number;
        adminWindow?: number;
      } | null;
      const adj = workspaceData.pricingPolicy.adjustments as {
        safetyMargin?: number;
      } | null;
      if (cond?.pricingThreshold !== undefined) {
        setPricingThreshold(String(cond.pricingThreshold));
      }
      if (cond?.adminWindow !== undefined) {
        setAdminWindow(String(cond.adminWindow));
      }
      if (adj?.safetyMargin !== undefined) {
        setSafetyMargin(String(adj.safetyMargin));
      }
    }
  }, [workspaceData, profile]);

  const updateWorkspaceMutation = useMutation(
    trpc.workspace.update.mutationOptions({
      onSuccess: () => {
        toast.success("Datos de la organización actualizados");
        void qc.invalidateQueries({ queryKey: [["workspace"]] });
        setOrgSaved(true);
        setTimeout(() => setOrgSaved(false), 2500);
      },
      onError: (err) => {
        toast.error(err.message || "Error al guardar la organización");
      },
    }),
  );

  const savePricingPolicyMutation = useMutation(
    trpc.workspace.savePricingPolicy.mutationOptions({
      onSuccess: () => {
        toast.success("Políticas del motor de precios guardadas");
        void qc.invalidateQueries({ queryKey: [["workspace"]] });
        setPricingSaved(true);
        setTimeout(() => setPricingSaved(false), 2500);
      },
      onError: (err) => {
        toast.error(err.message || "Error al guardar políticas de precios");
      },
    }),
  );

  const toggleModuleMutation = useMutation(
    trpc.workspace.toggleModule.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["workspace"]] });
      },
      onError: (err) => {
        toast.error(err.message || "Error al actualizar módulo");
      },
    }),
  );

  const acceptInviteMutation = useMutation(
    trpc.workspace.acceptInvite.mutationOptions({
      onSuccess: () => {
        toast.success("Invitación aceptada");
        void refetchInvitations();
        void qc.invalidateQueries({ queryKey: [["workspace"]] });
      },
      onError: (err) => {
        toast.error(err.message || "Error al aceptar invitación");
      },
    }),
  );

  const declineInviteMutation = useMutation(
    trpc.workspace.declineInvite.mutationOptions({
      onSuccess: () => {
        toast.success("Invitación rechazada");
        void refetchInvitations();
      },
      onError: (err) => {
        toast.error(err.message || "Error al rechazar invitación");
      },
    }),
  );

  const toggleModule = (key: string) => {
    const nextEnabled = !modules[key];
    setModules((prev) => ({ ...prev, [key]: nextEnabled }));
    toggleModuleMutation.mutate({
      module: key as never,
      enabled: nextEnabled,
    });
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    updateWorkspaceMutation.mutate({
      name: orgName.trim(),
      legalName: orgLegalName.trim() || undefined,
      taxId: orgRif.trim() || undefined,
    });
  };

  const handleSavePricing = (e: React.FormEvent) => {
    e.preventDefault();
    savePricingPolicyMutation.mutate({
      pricingThreshold: Number(pricingThreshold) || 5,
      adminWindow: Number(adminWindow) || 24,
      safetyMargin: Number(safetyMargin) || 3.5,
    });
  };

  const activeModulesCount = useMemo(
    () => Object.values(modules).filter(Boolean).length,
    [modules],
  );

  if (loadingProfile && loadingWorkspace) {
    return (
      <div className="space-y-6 py-4 lg:py-8">
        <div className="border-border bg-card animate-pulse border p-6">
          <div className="bg-muted h-8 w-48" />
          <div className="bg-muted mt-4 h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 lg:py-8">
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
          icon="DeployedCode"
          tone="primary"
          sub="Arquitectura operativa"
        />
        <StatCard
          label="Plan del Workspace"
          value={workspaceData?.plan ? workspaceData.plan.toUpperCase() : "PRO"}
          icon="Verified"
          tone="success"
          sub="Suscripción empresarial"
        />
        <StatCard
          label="Zona Horaria"
          value="VET (-04:00)"
          icon="Schedule"
          tone="default"
          sub="Caracas, Venezuela"
        />
        <StatCard
          label="Moneda Primaria"
          value="USD ($)"
          icon="Payments"
          tone="default"
          sub="Tasa Operativa: BCV"
        />
      </div>

      {/* Profile Card */}
      {profile && (
        <div className="border-border bg-card flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-medium uppercase">
              {profile.fullName
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-foreground truncate text-sm font-medium">
                  {profile.fullName}
                </p>
                <StatusPill tone="default">{profile.role}</StatusPill>
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {profile.email} · @{profile.username}
              </p>
            </div>
          </div>

          <div className="border-border flex flex-wrap items-center gap-3 border-t pt-3 sm:border-t-0 sm:pt-0">
            <Link
              href="/settings/security"
              className="border-border bg-background hover:bg-muted/40 text-foreground inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors"
            >
              <Icons.Lock className="size-3.5" />
              Seguridad & MFA (2FA)
            </Link>
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
              <Icons.Shield className="size-3.5" />
              <span>Sesión Autenticada</span>
            </div>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <div className="border-border bg-card border p-5">
          <h2 className="text-foreground mb-3 text-xs font-medium tracking-widest uppercase">
            Invitaciones Pendientes a Workspaces ({pendingInvitations.length})
          </h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.workspaceId}
                className="border-border bg-background flex flex-col gap-2 border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="text-foreground text-xs font-medium">
                    {inv.workspaceName}
                  </span>
                  <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                    Rol: {inv.role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={acceptInviteMutation.isPending}
                    onClick={() =>
                      acceptInviteMutation.mutate({
                        workspaceId: inv.workspaceId,
                      })
                    }
                    className="h-7 text-xs"
                  >
                    Aceptar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={declineInviteMutation.isPending}
                    onClick={() =>
                      declineInviteMutation.mutate({
                        workspaceId: inv.workspaceId,
                      })
                    }
                    className="h-7 text-xs"
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organization Settings */}
      <div className="border-border bg-card border p-6">
        <div className="border-border mb-5 border-b pb-4">
          <h2 className="text-foreground flex items-center gap-2 text-base font-medium">
            <Icons.Business className="text-primary size-4.5" />
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
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 text-xs transition-colors outline-none"
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
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 text-xs transition-colors outline-none"
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
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 font-mono text-xs uppercase transition-colors outline-none"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Zona Horaria Operativa
              </label>
              <select
                value={orgTimezone}
                onChange={(e) => setOrgTimezone(e.target.value)}
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 text-xs transition-colors outline-none"
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

          <div className="border-border flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-[11px]">
              Los cambios se propagarán a todos los módulos y comprobantes
              impresos.
            </span>

            <Button
              type="submit"
              disabled={updateWorkspaceMutation.isPending}
              className="h-8 text-xs font-medium"
            >
              {updateWorkspaceMutation.isPending ? (
                <>
                  <Icons.ProgressActivity className="mr-1.5 size-3.5 animate-spin" />
                  Guardando...
                </>
              ) : orgSaved ? (
                <>
                  <Icons.Check className="mr-1.5 size-3.5" />
                  Guardado Correctamente
                </>
              ) : (
                <>
                  <Icons.Check className="mr-1.5 size-3.5" />
                  Guardar Organización
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Modules Architecture Grid */}
      <div className="border-border bg-card border p-6">
        <div className="border-border mb-5 border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground flex items-center gap-2 text-base font-medium">
                <Icons.DeployedCode className="text-primary size-4.5" />
                Arquitectura de Módulos ERP
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Activa o desactiva capacidades según la estructura comercial de
                tu empresa
              </p>
            </div>
            <StatusPill tone="default">{activeModulesCount} Activos</StatusPill>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_MODULES.map((mod) => {
            const isEnabled = modules[mod.key];

            return (
              <div
                key={mod.key}
                onClick={() => toggleModule(mod.key)}
                className={`flex cursor-pointer items-start justify-between border p-3.5 transition-colors ${
                  isEnabled
                    ? "border-foreground/30 bg-primary/5"
                    : "border-border bg-background hover:bg-muted/30"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center ${
                      isEnabled
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon name={mod.icon} className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-xs font-medium">
                      {mod.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>

                <div
                  className={`relative h-5 w-9 shrink-0 border transition-colors ${
                    isEnabled
                      ? "border-primary bg-primary"
                      : "border-border bg-muted"
                  }`}
                >
                  <div
                    className={`bg-background absolute top-0.5 size-3.5 transition-transform ${
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
      <div className="border-border bg-card border p-6">
        <div className="border-border mb-5 border-b pb-4">
          <h2 className="text-foreground flex items-center gap-2 text-base font-medium">
            <Icons.Sell className="text-primary size-4.5" />
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
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 font-mono text-xs tabular-nums transition-colors outline-none"
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
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 font-mono text-xs tabular-nums transition-colors outline-none"
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
                className="border-border bg-background text-foreground focus:border-foreground w-full border px-3 py-2 font-mono text-xs tabular-nums transition-colors outline-none"
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                Colchón preventivo incorporado en cotizaciones diferidas a
                crédito.
              </p>
            </div>
          </div>

          <div className="border-border flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-[11px]">
              El motor evaluará cada fluctuación oficial emitida por el Banco
              Central de Venezuela.
            </span>

            <Button type="submit" className="h-8 text-xs font-medium">
              {pricingSaved ? (
                <>
                  <Icons.Check className="mr-1.5 size-3.5" />
                  Políticas Guardadas
                </>
              ) : (
                <>
                  <Icons.Tune className="mr-1.5 size-3.5" />
                  Guardar Políticas
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Multi-Legal Entity & Multi-Branch (PRD v2.0, F11.2) */}
      <div className="border-border bg-card space-y-5 border p-6">
        <div className="border-border border-b pb-4">
          <h2 className="text-foreground flex items-center gap-2 text-base font-medium">
            <Icons.Storefront className="text-primary size-4.5" />
            Multi-Compañía (RIF) & Sucursales Operativas (SENIAT)
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Gestión de entidades legales, agentes de retención especial y series
            de facturación por sucursal
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Legal Entities */}
          <div className="space-y-3">
            <h3 className="text-foreground text-xs font-medium">
              Entidades Legales Registradas ({(legalEntities ?? []).length})
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveLegalEntityMutation.mutate({
                  rif: newEntityRif,
                  legalName: newEntityName,
                  fiscalAddress: newEntityAddress,
                  isSpecialTaxpayer: true,
                  retentionRatePct: 75,
                });
              }}
              className="border-border bg-background space-y-2.5 border p-3.5"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  id="new-entity-rif"
                  name="newEntityRif"
                  type="text"
                  required
                  value={newEntityRif}
                  onChange={(e) => setNewEntityRif(e.target.value)}
                  placeholder="RIF (Ej. J-40123456-7)"
                  className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs uppercase"
                />
                <input
                  id="new-entity-name"
                  name="newEntityName"
                  type="text"
                  required
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="Razón Social"
                  className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 text-xs"
                />
              </div>
              <input
                id="new-entity-address"
                name="newEntityAddress"
                type="text"
                required
                value={newEntityAddress}
                onChange={(e) => setNewEntityAddress(e.target.value)}
                placeholder="Domicilio Fiscal SENIAT"
                className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 text-xs"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={saveLegalEntityMutation.isPending}
                  className="h-7 text-xs"
                >
                  <Icons.Add className="mr-1 size-3.5" />
                  Registrar Entidad Legal
                </Button>
              </div>
            </form>

            {(legalEntities ?? []).length > 0 ? (
              <div className="divide-border border-border divide-y border text-xs">
                {(legalEntities ?? []).map((le) => (
                  <div
                    key={le.id}
                    className="flex items-center justify-between p-2.5"
                  >
                    <div>
                      <span className="text-foreground font-mono font-medium">
                        {le.rif}
                      </span>{" "}
                      — <span className="text-foreground">{le.legalName}</span>
                      <p className="text-muted-foreground text-[11px]">
                        {le.fiscalAddress}
                      </p>
                    </div>
                    <StatusPill tone="info">
                      Ret. {le.retentionRatePct}%
                    </StatusPill>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Branches */}
          <div className="space-y-3">
            <h3 className="text-foreground text-xs font-medium">
              Sucursales & Series Fiscales ({(branches ?? []).length})
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const targetEntityId =
                  selectedEntityForBranch || legalEntities?.[0]?.id;
                if (!targetEntityId) {
                  toast.error("Primero registre una entidad legal (RIF)");
                  return;
                }
                saveBranchMutation.mutate({
                  legalEntityId: targetEntityId,
                  code: newBranchCode,
                  name: newBranchName,
                  invoiceSeriesPrefix: newBranchSeries,
                });
              }}
              className="border-border bg-background space-y-2.5 border p-3.5"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  id="branch-legal-entity"
                  name="branchLegalEntity"
                  value={selectedEntityForBranch}
                  onChange={(e) => setSelectedEntityForBranch(e.target.value)}
                  className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 text-xs"
                >
                  <option value="">Entidad Legal por defecto</option>
                  {(legalEntities ?? []).map((le) => (
                    <option key={le.id} value={le.id}>
                      {le.rif} — {le.legalName}
                    </option>
                  ))}
                </select>
                <input
                  id="new-branch-code"
                  name="newBranchCode"
                  type="text"
                  required
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  placeholder="Código (SUC-01)"
                  className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs uppercase"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  id="new-branch-name"
                  name="newBranchName"
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Nombre de Sucursal"
                  className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 text-xs"
                />
                <input
                  id="new-branch-series"
                  name="newBranchSeries"
                  type="text"
                  required
                  value={newBranchSeries}
                  onChange={(e) => setNewBranchSeries(e.target.value)}
                  placeholder="Serie Factura (A, B...)"
                  className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs uppercase"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={saveBranchMutation.isPending}
                  className="h-7 text-xs"
                >
                  <Icons.Add className="mr-1 size-3.5" />
                  Registrar Sucursal
                </Button>
              </div>
            </form>

            {(branches ?? []).length > 0 ? (
              <div className="divide-border border-border divide-y border text-xs">
                {(branches ?? []).map((br) => (
                  <div
                    key={br.id}
                    className="flex items-center justify-between p-2.5"
                  >
                    <div>
                      <span className="text-foreground font-mono font-medium">
                        {br.code}
                      </span>{" "}
                      — <span className="text-foreground">{br.name}</span>
                    </div>
                    <StatusPill tone="default">
                      Serie {br.invoiceSeriesPrefix} ({br.controlNumberPrefix})
                    </StatusPill>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
