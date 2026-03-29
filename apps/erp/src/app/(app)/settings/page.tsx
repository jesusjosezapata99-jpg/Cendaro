"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { createSupabaseBrowserClient } from "@cendaro/auth/client";

import { env } from "~/env";
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

  // ── MFA State ─────────────────────────────────────────────────────────
  interface MfaFactor {
    id: string;
    friendly_name?: string;
    factor_type: string;
  }
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [mfaSuccess, setMfaSuccess] = useState("");

  const supabase = createSupabaseBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const loadMfaFactors = useCallback(async () => {
    setMfaLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaFactors(data?.totp ?? []);
    } catch {
      // silently fail — not critical for settings load
    } finally {
      setMfaLoading(false);
    }
  }, [supabase.auth.mfa]);

  useEffect(() => {
    void loadMfaFactors();
  }, [loadMfaFactors]);

  async function handleMfaEnroll() {
    setMfaError("");
    setMfaSuccess("");
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Cendaro Authenticator",
      });
      if (enrollError) {
        setMfaError(enrollError.message);
        return;
      }
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaFactorId(data.id);
      setMfaEnrolling(true);
    } catch {
      setMfaError("Error al iniciar la configuración MFA.");
    }
  }

  async function handleMfaVerify() {
    if (mfaVerifyCode.length !== 6) return;
    setMfaVerifying(true);
    setMfaError("");
    try {
      const { data: challenge, error: challengeErr } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeErr) {
        setMfaError("Error al crear desafío.");
        setMfaVerifying(false);
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaVerifyCode,
      });
      if (verifyErr) {
        setMfaError("Código incorrecto. Verifica e intenta de nuevo.");
        setMfaVerifyCode("");
        setMfaVerifying(false);
        return;
      }
      setMfaSuccess("¡2FA activado exitosamente!");
      setMfaEnrolling(false);
      setMfaQrCode("");
      setMfaSecret("");
      setMfaVerifyCode("");
      await loadMfaFactors();
    } catch {
      setMfaError("Error de conexión.");
    } finally {
      setMfaVerifying(false);
    }
  }

  async function handleMfaUnenroll(factorId: string) {
    setMfaError("");
    setMfaSuccess("");
    try {
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      if (unenrollErr) {
        setMfaError(unenrollErr.message);
        return;
      }
      setMfaSuccess("Factor 2FA eliminado.");
      await loadMfaFactors();
    } catch {
      setMfaError("Error al eliminar factor.");
    }
  }

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

      {/* ── Security / MFA ─────────────────────────────────────────── */}
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            shield
          </span>
          <div>
            <h2 className="text-lg font-semibold">Seguridad</h2>
            <p className="text-muted-foreground text-sm">
              Autenticación de dos factores (2FA/TOTP)
            </p>
          </div>
        </div>

        {/* Status alerts */}
        {mfaError && (
          <div className="bg-destructive/10 text-destructive border-destructive/15 mb-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm">
            <span className="material-symbols-outlined text-base">error</span>
            <span className="font-medium">{mfaError}</span>
          </div>
        )}
        {mfaSuccess && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined text-base">
              check_circle
            </span>
            <span className="font-medium">{mfaSuccess}</span>
          </div>
        )}

        {/* Loading */}
        {mfaLoading ? (
          <div className="flex items-center gap-3 py-4">
            <div className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="text-muted-foreground text-sm">
              Cargando estado de seguridad...
            </span>
          </div>
        ) : mfaFactors.length > 0 ? (
          /* Enrolled factors list */
          <div className="space-y-3">
            {mfaFactors.map((factor) => (
              <div
                key={factor.id}
                className="border-border flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-xl">
                      verified_user
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {factor.friendly_name ?? "Autenticador TOTP"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Activo · {factor.factor_type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void handleMfaUnenroll(factor.id)}
                  className="text-destructive hover:bg-destructive/10 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  Desactivar
                </button>
              </div>
            ))}
          </div>
        ) : !mfaEnrolling ? (
          /* No factors — show enroll button */
          <div className="border-border rounded-lg border border-dashed p-6 text-center">
            <div className="bg-muted mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
              <span className="material-symbols-outlined text-muted-foreground text-2xl">
                lock_open
              </span>
            </div>
            <p className="text-foreground text-sm font-semibold">
              2FA no configurado
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Protege tu cuenta con un código de verificación adicional
            </p>
            <button
              onClick={() => void handleMfaEnroll()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              Configurar 2FA
            </button>
          </div>
        ) : (
          /* Enrollment flow */
          <div className="space-y-4">
            {/* QR Code */}
            <div className="text-center">
              <p className="text-foreground mb-3 text-sm font-semibold">
                Escanea este código QR con tu app autenticadora
              </p>
              <div className="bg-background mx-auto mb-3 inline-flex size-48 items-center justify-center rounded-2xl border p-2">
                <img src={mfaQrCode} alt="QR Code TOTP" className="size-full" />
              </div>
              <div className="bg-secondary/60 border-border/60 mx-auto max-w-xs rounded-lg border px-3 py-2">
                <p className="text-muted-foreground mb-1 text-[0.65rem] uppercase">
                  Código manual
                </p>
                <code className="text-foreground font-mono text-xs font-semibold tracking-widest break-all">
                  {mfaSecret}
                </code>
              </div>
            </div>

            {/* Verify code input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Código de verificación
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaVerifyCode}
                  onChange={(e) =>
                    setMfaVerifyCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  placeholder="000000"
                  className="border-border bg-background focus:border-primary focus:ring-primary/20 flex-1 rounded-lg border px-3 py-2 text-center font-mono text-lg tracking-widest focus:ring-2 focus:outline-none"
                />
                <button
                  onClick={() => void handleMfaVerify()}
                  disabled={mfaVerifying || mfaVerifyCode.length !== 6}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mfaVerifying ? "Verificando..." : "Activar"}
                </button>
              </div>
            </div>

            {/* Cancel */}
            <button
              onClick={() => {
                setMfaEnrolling(false);
                setMfaQrCode("");
                setMfaSecret("");
                setMfaVerifyCode("");
                setMfaError("");
              }}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Mandatory note for owner/admin */}
        {profile &&
          ["owner", "admin"].includes(profile.role) &&
          mfaFactors.length === 0 &&
          !mfaEnrolling && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined mt-0.5 text-sm">
                warning
              </span>
              <span>
                <strong>Obligatorio:</strong> Como {profile.role}, debes
                configurar 2FA. Se te pedirá configurarlo en tu próximo inicio
                de sesión.
              </span>
            </div>
          )}
      </section>

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
          Configuración del motor de repricing automático basado en la tasa{" "}
          <strong className="text-foreground">BCV</strong>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Umbral <strong>BCV</strong> para auto-repricing (%)
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
              Si la tasa <strong className="text-foreground">BCV</strong> sube
              este % o más, los precios se actualizan automáticamente
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
