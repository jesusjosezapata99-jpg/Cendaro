"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, Input } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

/**
 * Cendaro — Enterprise Login Page (PLAN-2026-09-DESIGN-SYSTEM §T9.1)
 *
 * Spec:
 * - Logo: Fixed top-left (w-6 h-6).
 * - Left half (lg:w-1/2, hidden on mobile): Monochrome static visual with real dashboard capture (DEV-8).
 * - Right half: Centered max-w-md with h1 Serif, inputs, primary button, error in text-destructive,
 *   session expired notice, and legal footer in text-xs.
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
  const sessionExpired = searchParams.get("expired") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        success?: boolean;
      };

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
    <div className="bg-background relative flex min-h-screen w-full">
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
              Bienvenido a Cendaro
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Inicia sesión en tu cuenta
            </p>
          </div>

          {/* Session expired banner */}
          {sessionExpired ? (
            <div className="border-border bg-muted/30 text-foreground mb-6 flex items-center gap-2.5 border p-3 text-xs">
              <Icons.Schedule className="text-muted-foreground size-4 shrink-0" />
              <span>
                Tu sesión expiró por inactividad. Inicia sesión de nuevo.
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

          {/* Form */}
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Ingresa tu contraseña"
                className="h-10"
              />
            </div>

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
