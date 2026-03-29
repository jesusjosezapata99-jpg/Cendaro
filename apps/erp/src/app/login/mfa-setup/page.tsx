"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@cendaro/auth/client";

import { env } from "~/env";

/**
 * MFA Setup Page — /login/mfa-setup
 *
 * Forced enrollment screen for owner/admin roles that don't have MFA
 * configured. They cannot bypass this screen — must complete TOTP
 * enrollment before accessing the system.
 *
 * Security:
 *   • Cannot skip — no "later" button for owner/admin
 *   • QR code displayed for authenticator app scanning
 *   • Verification code required to confirm enrollment
 *   • Factor is created as "unverified" then upgraded to "verified"
 */

type EnrollmentState = "loading" | "scan" | "verify" | "success" | "error";

export default function MfaSetupPage() {
  const router = useRouter();
  const [state, setState] = useState<EnrollmentState>("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createSupabaseBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  // Start enrollment on mount
  useEffect(() => {
    async function startEnrollment() {
      try {
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Cendaro Authenticator",
        });

        if (enrollError) {
          setError(enrollError.message);
          setState("error");
          return;
        }

        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setState("scan");
      } catch {
        setError("Error al configurar MFA. Intente de nuevo.");
        setState("error");
      }
    }

    void startEnrollment();
  }, []);

  // Auto-focus verification input when switching to verify step
  useEffect(() => {
    if (state === "verify") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state]);

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6 || loading) return;

    setError("");
    setLoading(true);

    try {
      // Create a challenge for the newly enrolled factor
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) {
        setError("Error al crear el desafío de verificación.");
        setLoading(false);
        return;
      }

      // Verify the code — this activates the factor and upgrades to aal2
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        setError(
          "Código incorrecto. Asegúrate de que tu aplicación autenticadora está sincronizada.",
        );
        setCode("");
        inputRef.current?.focus();
        setLoading(false);
        return;
      }

      // Success — factor is now verified, session upgraded to aal2
      setState("success");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (clean.length === 6) {
      setTimeout(() => void handleVerify(), 0);
    }
  }

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-primary/4 absolute -top-40 -left-40 size-[500px] rounded-full blur-[120px]" />
        <div className="bg-primary/6 absolute -right-32 -bottom-32 size-[400px] rounded-full blur-[100px]" />
        <div className="bg-primary/2.5 absolute top-1/3 left-1/2 size-[300px] -translate-x-1/2 rounded-full blur-[80px]" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Logo & Brand */}
        <div className="mb-10 text-center">
          <div className="shadow-primary/20 mx-auto mb-5 flex size-16 items-center justify-center transition-transform duration-300 hover:scale-105">
            <Image
              src="/cendaro-logo.png"
              alt="Cendaro"
              width={64}
              height={64}
              className="size-16"
              priority
            />
          </div>
          <h1 className="text-foreground text-[1.75rem] font-black tracking-tight">
            Configurar 2FA
          </h1>
          <p className="text-muted-foreground/70 mt-1.5 text-[0.8rem] font-medium tracking-wide uppercase">
            Autenticación Obligatoria de Dos Factores
          </p>
        </div>

        {/* Setup Card */}
        <div className="border-border/60 bg-card/80 rounded-2xl border p-8 shadow-2xl shadow-black/5 backdrop-blur-xl">
          {/* Mandatory notice */}
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined mt-0.5 text-base">
              warning
            </span>
            <div>
              <p className="font-semibold">Configuración obligatoria</p>
              <p className="mt-0.5 text-xs opacity-80">
                Como administrador, debes configurar la autenticación de dos
                factores para acceder al sistema.
              </p>
            </div>
          </div>

          {/* Loading State */}
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-muted-foreground text-sm">
                Generando código QR...
              </p>
            </div>
          )}

          {/* Error State */}
          {state === "error" && (
            <div className="py-8 text-center">
              <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
                <span className="material-symbols-outlined text-3xl">
                  error
                </span>
              </div>
              <p className="text-destructive text-sm font-medium">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-primary mt-4 text-sm font-semibold underline-offset-2 hover:underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Step 1: Scan QR Code */}
          {state === "scan" && (
            <div>
              {/* Step indicator */}
              <div className="mb-6 flex items-center gap-3">
                <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-bold">
                  1
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    Escanea el código QR
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Abre tu app autenticadora y escanea este código
                  </p>
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-background mx-auto mb-6 flex size-56 items-center justify-center rounded-2xl border p-2">
                <img
                  src={qrCode}
                  alt="QR Code para autenticador"
                  className="size-full"
                />
              </div>

              {/* Manual Secret */}
              <div className="mb-6">
                <p className="text-muted-foreground mb-2 text-center text-xs">
                  ¿No puedes escanear? Ingresa este código manualmente:
                </p>
                <div className="bg-secondary/60 border-border/60 rounded-lg border px-4 py-3 text-center">
                  <code className="text-foreground font-mono text-xs font-semibold tracking-widest break-all">
                    {secret}
                  </code>
                </div>
              </div>

              {/* Next button */}
              <button
                onClick={() => setState("verify")}
                className="group from-primary to-primary/90 text-primary-foreground shadow-primary/20 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 py-3 text-sm font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-110"
              >
                <span>Ya escaneé el código</span>
                <span className="material-symbols-outlined text-base transition-transform duration-200 group-hover:translate-x-0.5">
                  arrow_forward
                </span>
              </button>
            </div>
          )}

          {/* Step 2: Verify Code */}
          {state === "verify" && (
            <form onSubmit={handleVerify}>
              {/* Step indicator */}
              <div className="mb-6 flex items-center gap-3">
                <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-bold">
                  2
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    Verifica el código
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Ingresa el código de 6 dígitos de tu app autenticadora
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-destructive/10 text-destructive border-destructive/15 mb-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm">
                  <span className="material-symbols-outlined text-base">
                    error
                  </span>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Code Input */}
              <div className="mb-6">
                <input
                  ref={inputRef}
                  id="setup-totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="000000"
                  className="border-border/80 bg-secondary/50 text-foreground placeholder:text-muted-foreground/30 focus:border-primary focus:bg-secondary/80 focus:ring-primary/15 w-full rounded-xl border px-4 py-4 text-center font-mono text-2xl tracking-[0.5em] transition-all duration-200 focus:ring-2 focus:outline-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="from-primary to-primary/90 text-primary-foreground shadow-primary/20 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 py-3 text-sm font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
                    <span>Activando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">
                      verified_user
                    </span>
                    <span>Activar 2FA</span>
                  </>
                )}
              </button>

              {/* Back to QR */}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setState("scan");
                }}
                className="text-muted-foreground/60 hover:text-muted-foreground mt-3 flex w-full items-center justify-center gap-1.5 text-[0.75rem] font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-xs">
                  arrow_back
                </span>
                Volver al código QR
              </button>
            </form>
          )}

          {/* Success State */}
          {state === "success" && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined text-3xl">
                  check_circle
                </span>
              </div>
              <h3 className="text-foreground text-lg font-bold">
                ¡2FA Activado!
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Tu cuenta ahora está protegida con autenticación de dos
                factores. Redirigiendo al panel...
              </p>
              <div className="border-primary mx-auto mt-4 size-6 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}

          {/* Security note */}
          <div className="text-muted-foreground/50 mt-5 flex items-center justify-center gap-1.5 text-[0.7rem]">
            <span className="material-symbols-outlined text-xs">shield</span>
            <span>
              Aplicaciones compatibles: Google Authenticator, 1Password, Authy
            </span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-muted-foreground/40 mt-8 text-center text-[0.7rem] font-medium tracking-wide">
          Cendaro © {new Date().getFullYear()} · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
