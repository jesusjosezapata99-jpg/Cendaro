"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Input } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { MfaFactor, TotpEnrollment } from "~/hooks/use-mfa";
import { PageHeader } from "~/components/page-header";
import { useMfa } from "~/hooks/use-mfa";
import { useTRPC } from "~/trpc/client";

type EnrollStep = "idle" | "enrolling" | "verifying";

export default function SecurityClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: status } = useQuery(trpc.users.mfaStatus.queryOptions());
  const mfa = useMfa();

  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [factorsLoaded, setFactorsLoaded] = useState(false);
  const [step, setStep] = useState<EnrollStep>("idle");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    const list = await mfa.listFactors();
    setFactors(list);
    setFactorsLoaded(true);
  }, [mfa]);

  useEffect(() => {
    void refreshFactors();
    // Only on mount — refreshFactors is re-created per render via listFactors' identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  async function handleStartEnroll() {
    setStep("enrolling");
    setVerifyError(null);
    const result = await mfa.enroll();
    if (!result) {
      setStep("idle");
      return;
    }
    setEnrollment(result);
    setStep("verifying");
  }

  async function handleVerify() {
    if (!enrollment) return;
    setVerifyError(null);
    const ok = await mfa.verify(enrollment.factorId, code);
    if (!ok) {
      setVerifyError(mfa.error ?? "Código inválido.");
      return;
    }
    setCode("");
    setEnrollment(null);
    setStep("idle");
    await refreshFactors();
    void qc.invalidateQueries({ queryKey: [["users", "mfaStatus"]] });
  }

  async function handleUnenroll(factorId: string) {
    const ok = await mfa.unenroll(factorId);
    if (ok) {
      await refreshFactors();
      void qc.invalidateQueries({ queryKey: [["users", "mfaStatus"]] });
    }
  }

  function handleCancelEnroll() {
    setEnrollment(null);
    setCode("");
    setVerifyError(null);
    setStep("idle");
  }

  return (
    <div>
      <PageHeader
        title="Seguridad — Autenticación de dos factores"
        description="Protege tu cuenta con un código de un solo uso (TOTP)."
      />

      {status ? (
        <div className="border-border bg-card mb-6 flex flex-col gap-3 border p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Icons.Shield className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {status.enrolled ? "MFA activo" : "MFA no activo"}
              </p>
              <p className="text-muted-foreground text-sm">
                {status.recommendation}
              </p>
            </div>
          </div>
          <StatusPill
            tone={
              status.blocked
                ? "destructive"
                : status.enrolled
                  ? "success"
                  : status.required
                    ? "warning"
                    : "neutral"
            }
          >
            {status.blocked
              ? "Bloqueado"
              : status.enrolled
                ? "Activo"
                : status.required
                  ? "Requerido"
                  : "Opcional"}
          </StatusPill>
        </div>
      ) : null}

      <div className="border-border bg-card border p-6">
        <h2 className="mb-4 text-sm font-medium">Factores TOTP registrados</h2>

        {factorsLoaded && verifiedFactor ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Icons.Verified className="text-status-success-fg size-5" />
              <div>
                <p className="text-sm font-medium">
                  {verifiedFactor.friendlyName ?? "Aplicación autenticadora"}
                </p>
                <p className="text-muted-foreground text-sm">Verificado</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => void handleUnenroll(verifiedFactor.id)}
              disabled={mfa.isLoading}
            >
              Desactivar
            </Button>
          </div>
        ) : null}

        {factorsLoaded && !verifiedFactor && step === "idle" ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">
              No tienes ningún factor de autenticación activo.
            </p>
            <Button onClick={() => void handleStartEnroll()}>
              <Icons.QrCode className="size-4" />
              Activar autenticación de dos factores
            </Button>
          </div>
        ) : null}

        {step === "enrolling" ? (
          <p className="text-muted-foreground text-sm">Generando código QR…</p>
        ) : null}

        {step === "verifying" && enrollment ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                className="border-border size-40 shrink-0 border bg-white p-2 [&_svg]:size-full"
                // Supabase Auth returns a server-generated SVG string for the
                // TOTP QR code (no client-side QR library needed).
                dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="text-sm">
                  Escanea el código con tu aplicación autenticadora (Google
                  Authenticator, 1Password, Authy) o ingresa esta clave
                  manualmente:
                </p>
                <code className="bg-muted border-border block w-fit border px-2 py-1 text-xs break-all">
                  {enrollment.secret}
                </code>
                <div className="flex flex-col gap-2 sm:max-w-xs">
                  <label htmlFor="totp-code" className="text-sm font-medium">
                    Código de 6 dígitos
                  </label>
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                  {verifyError ? (
                    <p className="text-status-destructive-fg text-sm">
                      {verifyError}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void handleVerify()}
                    disabled={mfa.isLoading || code.length !== 6}
                  >
                    Verificar y activar
                  </Button>
                  <Button variant="outline" onClick={handleCancelEnroll}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
