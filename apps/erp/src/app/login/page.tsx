"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";

import { Button, Input } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { env } from "~/env";
import { sanitizeRedirectPath } from "~/lib/redirect-allowlist";
import { getSupabaseBrowserClient } from "~/lib/supabase-browser";

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileError?: () => void;
  }
}

/**
 * Cendaro — Enterprise Login Page (PLAN-2026-09-DESIGN-SYSTEM §T9.1 + F9.1/F9.2)
 *
 * Spec:
 * - Logo: Fixed top-left (w-6 h-6).
 * - Left half (lg:w-1/2, hidden on mobile): Monochrome static visual with real dashboard capture (DEV-8).
 * - Right half: Centered max-w-md with h1 Serif, inputs, primary button, error in text-destructive,
 *   session expired / inactivity notice, TOTP aal2 challenge step, and legal footer in text-xs.
 * - Zero rounded-* (0-radius), zero shadows, zero hex literals, 100% WCAG AA contrast.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired =
    searchParams.get("expired") === "1" ||
    searchParams.get("reason") === "inactivity";
  const redirectPath = sanitizeRedirectPath(searchParams.get("redirect"));
  const turnstileSiteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string>("");
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    window.onTurnstileSuccess = (token: string) => {
      setCaptchaToken(token);
    };
    window.onTurnstileError = () => {
      setCaptchaToken("");
    };
    return () => {
      delete window.onTurnstileSuccess;
      delete window.onTurnstileError;
    };
  }, [turnstileSiteKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          ...(captchaToken ? { captchaToken } : {}),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        success?: boolean;
      };

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }

      // Check whether the authenticated user has an enrolled TOTP factor requiring aal2 (F9.2)
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: aalData } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const verifiedTotp = factorsData?.totp[0];
          if (verifiedTotp) {
            setMfaFactorId(verifiedTotp.id);
            setMfaStep(true);
            return;
          }
        }
      } catch {
        // Proceed to redirect if MFA inspection is unavailable
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || totpCode.length !== 6) return;
    setError("");
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify(
        {
          factorId: mfaFactorId,
          code: totpCode,
        },
      );

      if (verifyError) {
        setError("Código 2FA inválido o expirado. Intenta nuevamente.");
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Error al verificar el código de dos factores.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background relative flex min-h-screen w-full">
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      ) : null}

      {/* Fixed top-left Logo */}
      <div className="fixed top-6 left-6 z-20">
        <Link
          href="/"
          className="focus-visible:ring-ring flex items-center gap-2.5 outline-none focus-visible:ring-1"
          aria-label="Cendaro — Ir al inicio"
        >
          <Image
            src="/cendaro-logo.png"
            alt="Cendaro"
            width={24}
            height={24}
            className="size-6 invert dark:invert-0"
            priority
          />
          <span className="text-foreground text-sm font-medium tracking-tight">
            Cendaro
          </span>
        </Link>
      </div>

      {/* Left Column — Monochrome Product Visual (hidden on mobile, DEV-8) */}
      <div className="border-border bg-card/30 relative hidden border-r p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div />

        {/* Dashboard Preview Frame */}
        <div className="my-auto flex flex-col items-center">
          <div className="border-border bg-card relative w-full max-w-xl overflow-hidden border">
            <div className="border-border bg-muted/40 flex h-8 items-center gap-1.5 border-b px-3">
              <div className="bg-border size-2" />
              <div className="bg-border size-2" />
              <div className="bg-border size-2" />
              <span className="text-muted-foreground/60 ml-2 font-mono text-[10px]">
                app.cendaro.com/dashboard
              </span>
            </div>
            <div className="bg-background relative aspect-16/10 w-full overflow-hidden">
              <Image
                src="/dashboard-preview.png"
                alt="Vista previa de Cendaro ERP"
                fill
                className="object-cover object-top"
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
              />
            </div>
          </div>

          <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
            Gestión inteligente de inventario, pedidos y finanzas para comercio
            mayorista.
          </p>
        </div>

        {/* Footnote on left visual */}
        <div className="text-muted-foreground/50 text-[11px]">
          Cendaro ERP — Core Design System
        </div>
      </div>

      {/* Right Column — Authentication Form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-left">
            <h1 className="text-foreground font-serif text-lg font-normal tracking-tight lg:text-xl">
              {mfaStep
                ? "Verificación de Dos Factores"
                : "Bienvenido a Cendaro"}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {mfaStep
                ? "Ingresa el código de 6 dígitos de tu aplicación autenticadora"
                : "Inicia sesión en tu cuenta"}
            </p>
          </div>

          {/* Session expired / inactivity banner */}
          {sessionExpired ? (
            <div className="border-border bg-muted/30 text-foreground mb-6 flex items-center gap-2.5 border p-3 text-xs">
              <Icons.Schedule className="text-muted-foreground size-4 shrink-0" />
              <span>
                Tu sesión se cerró automáticamente por 30 minutos de
                inactividad. Inicia sesión de nuevo.
              </span>
            </div>
          ) : null}

          {/* Error Banner */}
          {error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 flex items-center gap-2.5 border p-3 text-xs">
              <Icons.Error className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {mfaStep ? (
            <form onSubmit={handleVerifyTotp} className="space-y-4">
              <div>
                <label
                  htmlFor="totpCode"
                  className="text-muted-foreground mb-1.5 block text-xs font-normal"
                >
                  Código TOTP (6 dígitos)
                </label>
                <Input
                  id="totpCode"
                  name="totpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(e.target.value.replace(/\D/g, ""))
                  }
                  required
                  placeholder="000000"
                  className="h-10 font-mono tracking-widest tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="h-10 w-full text-sm font-medium"
                >
                  {loading ? "Verificando..." : "Confirmar Código 2FA"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMfaStep(false);
                    setMfaFactorId(null);
                    setTotpCode("");
                    setError("");
                  }}
                  className="h-10 w-full text-xs"
                >
                  Volver al inicio de sesión
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="text-muted-foreground mb-1.5 block text-xs font-normal"
                >
                  Usuario
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="Ingresa tu nombre de usuario"
                  className="h-10"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-muted-foreground mb-1.5 block text-xs font-normal"
                >
                  Contraseña
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Ingresa tu contraseña"
                  className="h-10"
                />
              </div>

              {turnstileSiteKey ? (
                <div className="pt-1">
                  <div
                    className="cf-turnstile"
                    data-sitekey={turnstileSiteKey}
                    data-callback="onTurnstileSuccess"
                    data-error-callback="onTurnstileError"
                    data-theme="auto"
                  />
                </div>
              ) : null}

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full text-sm font-medium"
                >
                  {loading ? (
                    <>
                      <span className="border-primary-foreground/30 border-t-primary-foreground mr-2 size-3.5 animate-spin border-2" />
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    "Acceder al Sistema"
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Legal Footer */}
          <div className="border-border mt-10 border-t pt-6 text-center">
            <p className="text-muted-foreground/60 text-xs leading-relaxed">
              Al iniciar sesión, confirmas tu acceso autorizado al entorno
              operativo de Cendaro ERP.
            </p>
            <p className="text-muted-foreground/40 mt-3 text-[11px]">
              Cendaro © {new Date().getFullYear()} · Todos los derechos
              reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
