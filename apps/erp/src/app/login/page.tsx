"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Ambient background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[500px] rounded-full bg-primary/4 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 size-[400px] rounded-full bg-primary/6 blur-[100px]" />
        <div className="absolute left-1/2 top-1/3 size-[300px] -translate-x-1/2 rounded-full bg-primary/2.5 blur-[80px]" />
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
          <div className="group mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/20 transition-transform duration-300 hover:scale-105">
            <span className="text-2xl font-black tracking-tighter">C</span>
          </div>
          <h1 className="text-[1.75rem] font-black tracking-tight text-foreground">
            Cendaro
          </h1>
          <p className="mt-1.5 text-[0.8rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
            Sistema ERP Omnicanal
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/5 backdrop-blur-xl"
        >
          <div className="mb-7">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Iniciar Sesión
            </h2>
            <p className="mt-1 text-[0.8rem] text-muted-foreground">
              Ingrese sus credenciales para acceder al panel
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/15 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="material-symbols-outlined text-base">error</span>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-5">
            {/* Username */}
            <div className="group">
              <label
                htmlFor="username"
                className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                  focusedField === "username" ? "text-primary" : "text-muted-foreground/80"
                }`}
              >
                <span className="material-symbols-outlined text-sm">person</span>
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
                  className="w-full rounded-xl border border-border/80 bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password */}
            <div className="group">
              <label
                htmlFor="password"
                className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
                  focusedField === "password" ? "text-primary" : "text-muted-foreground/80"
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
                  className="w-full rounded-xl border border-border/80 bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="group mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-primary to-primary/90 px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <>
                <span>Acceder al Sistema</span>
                <span className="material-symbols-outlined text-base transition-transform duration-200 group-hover:translate-x-0.5">arrow_forward</span>
              </>
            )}
          </button>

          {/* Security note */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[0.7rem] text-muted-foreground/50">
            <span className="material-symbols-outlined text-xs">shield</span>
            <span>Conexión segura · Solo usuarios autorizados</span>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-[0.7rem] font-medium text-muted-foreground/40 tracking-wide">
          Cendaro © {new Date().getFullYear()} · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
