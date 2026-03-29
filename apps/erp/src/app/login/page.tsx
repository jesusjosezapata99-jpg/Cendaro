"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json()) as {
        error?: string;
        requiresMfa?: boolean;
        requiresMfaSetup?: boolean;
      };

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }

      // MFA routing: redirect based on factor enrollment status
      if (data.requiresMfaSetup) {
        // Owner/admin without MFA → forced enrollment
        router.push("/login/mfa-setup");
      } else if (data.requiresMfa) {
        // User has verified TOTP factor → must complete challenge
        router.push("/login/mfa");
      } else {
        // No MFA required — direct access
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
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
            Cendaro
          </h1>
          <p className="text-muted-foreground/70 mt-1.5 text-[0.8rem] font-medium tracking-wide uppercase">
            Sistema ERP Omnicanal
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="border-border/60 bg-card/80 rounded-2xl border p-8 shadow-2xl shadow-black/5 backdrop-blur-xl"
        >
          <div className="mb-7">
            <h2 className="text-foreground text-xl font-bold tracking-tight">
              Iniciar Sesión
            </h2>
            <p className="text-muted-foreground mt-1 text-[0.8rem]">
              Ingrese sus credenciales para acceder al panel
            </p>
          </div>

          {/* Session expired notice */}
          {sessionExpired && (
            <div className="animate-in fade-in slide-in-from-top-1 mb-5 flex items-center gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 duration-200 dark:text-amber-400">
              <span className="material-symbols-outlined text-base">
                schedule
              </span>
              <span className="font-medium">
                Tu sesión expiró por inactividad. Inicia sesión de nuevo.
              </span>
            </div>
          )}
          {/* Error Alert */}
          {error && (
            <div className="bg-destructive/10 text-destructive border-destructive/15 animate-in fade-in slide-in-from-top-1 mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm duration-200">
              <span className="material-symbols-outlined text-base">error</span>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-5">
            {/* Username */}
            <div className="group">
              <label
                htmlFor="username"
                className={`mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase transition-colors duration-200 ${
                  focusedField === "username"
                    ? "text-primary"
                    : "text-muted-foreground/80"
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  person
                </span>
                Usuario
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="username"
                  placeholder="Ingrese su nombre de usuario"
                  className="border-border/80 bg-secondary/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-secondary/80 focus:ring-primary/15 w-full rounded-xl border px-4 py-3 text-sm transition-all duration-200 focus:ring-2 focus:outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div className="group">
              <label
                htmlFor="password"
                className={`mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase transition-colors duration-200 ${
                  focusedField === "password"
                    ? "text-primary"
                    : "text-muted-foreground/80"
                }`}
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="current-password"
                  placeholder="Ingrese su contraseña"
                  className="border-border/80 bg-secondary/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-secondary/80 focus:ring-primary/15 w-full rounded-xl border px-4 py-3 text-sm transition-all duration-200 focus:ring-2 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="group from-primary to-primary/90 text-primary-foreground shadow-primary/20 hover:shadow-primary/30 focus:ring-primary/50 focus:ring-offset-background mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 py-3 text-sm font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-110 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <>
                <span>Acceder al Sistema</span>
                <span className="material-symbols-outlined text-base transition-transform duration-200 group-hover:translate-x-0.5">
                  arrow_forward
                </span>
              </>
            )}
          </button>

          {/* Security note */}
          <div className="text-muted-foreground/50 mt-5 flex items-center justify-center gap-1.5 text-[0.7rem]">
            <span className="material-symbols-outlined text-xs">shield</span>
            <span>Conexión segura · Solo usuarios autorizados</span>
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
