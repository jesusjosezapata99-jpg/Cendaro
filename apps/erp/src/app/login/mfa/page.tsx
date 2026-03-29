"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@cendaro/auth/client";

import { env } from "~/env";

/**
 * MFA Challenge Page — /login/mfa
 *
 * Shown after successful password authentication when the user has a
 * verified TOTP factor enrolled. The user must enter their 6-digit
 * TOTP code from their authenticator app to upgrade from aal1 → aal2.
 *
 * Security:
 *   • Max 5 verification attempts before forced re-login
 *   • Auto-submit on 6 digits entered
 *   • Session refresh on successful verification
 *   • Redirect to /login on failure exhaustion
 */

const MAX_ATTEMPTS = 5;

export default function MfaChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const supabase = createSupabaseBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6 || loading) return;

    setError("");
    setLoading(true);

    try {
      // Get the user's verified TOTP factor
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factors.totp[0];
      if (!totpFactor) {
        setError("No se encontró un factor TOTP verificado.");
        setLoading(false);
        return;
      }

      // Create a challenge
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challengeError) {
        setError("Error al crear el desafío de verificación.");
        setLoading(false);
        return;
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        const remaining = MAX_ATTEMPTS - (attempts + 1);
        setAttempts((a) => a + 1);

        if (remaining <= 0) {
          // Force re-login after too many failed attempts
          await supabase.auth.signOut({ scope: "local" });
          router.push("/login");
          return;
        }

        setError(
          `Código incorrecto. ${remaining} ${remaining === 1 ? "intento restante" : "intentos restantes"}.`,
        );
        setCode("");
        inputRef.current?.focus();
        setLoading(false);
        return;
      }

      // Success — session is now aal2, redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit when 6 digits are entered
  function handleCodeChange(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (clean.length === 6) {
      // Defer submission to next tick so state is updated
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

      <div className="relative z-10 w-full max-w-[420px]">
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
            Verificación 2FA
          </h1>
          <p className="text-muted-foreground/70 mt-1.5 text-[0.8rem] font-medium tracking-wide uppercase">
            Autenticación de Dos Factores
          </p>
        </div>

        {/* MFA Challenge Card */}
        <form
          onSubmit={handleVerify}
          className="border-border/60 bg-card/80 rounded-2xl border p-8 shadow-2xl shadow-black/5 backdrop-blur-xl"
        >
          <div className="mb-7 text-center">
            <div className="bg-primary/10 text-primary mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
              <span className="material-symbols-outlined text-3xl">
                security
              </span>
            </div>
            <h2 className="text-foreground text-xl font-bold tracking-tight">
              Código de Verificación
            </h2>
            <p className="text-muted-foreground mt-2 text-[0.8rem] leading-relaxed">
              Ingresa el código de 6 dígitos de tu aplicación autenticadora
              (Google Authenticator, 1Password, Authy)
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-destructive/10 text-destructive border-destructive/15 animate-in fade-in slide-in-from-top-1 mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm duration-200">
              <span className="material-symbols-outlined text-base">error</span>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* TOTP Code Input */}
          <div className="mb-6">
            <label
              htmlFor="totp-code"
              className="text-muted-foreground/80 mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wider uppercase"
            >
              <span className="material-symbols-outlined text-sm">pin</span>
              Código TOTP
            </label>
            <input
              ref={inputRef}
              id="totp-code"
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
            className="group from-primary to-primary/90 text-primary-foreground shadow-primary/20 hover:shadow-primary/30 focus:ring-primary/50 focus:ring-offset-background flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 py-3 text-sm font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-110 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">
                  verified_user
                </span>
                <span>Verificar Código</span>
              </>
            )}
          </button>

          {/* Back to login */}
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut({ scope: "local" });
              router.push("/login");
            }}
            className="text-muted-foreground/60 hover:text-muted-foreground mt-4 flex w-full items-center justify-center gap-1.5 text-[0.75rem] font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-xs">
              arrow_back
            </span>
            Volver al inicio de sesión
          </button>

          {/* Security note */}
          <div className="text-muted-foreground/50 mt-5 flex items-center justify-center gap-1.5 text-[0.7rem]">
            <span className="material-symbols-outlined text-xs">shield</span>
            <span>
              Intento {attempts + 1} de {MAX_ATTEMPTS}
            </span>
          </div>
        </form>

        {/* Footer */}
        <p className="text-muted-foreground/40 mt-8 text-center text-[0.7rem] font-medium tracking-wide">
          Cendaro © {new Date().getFullYear()} · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
