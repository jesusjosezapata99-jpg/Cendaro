"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { can } from "@cendaro/validators";

import { useCurrentUser } from "~/hooks/use-current-user";
import { useTRPC } from "~/trpc/client";

const RATE_LABELS: Record<string, string> = {
  bcv: "Tasa Oficial (BCV)",
  parallel: "Paralelo (USDT)",
  rmb_usd: "RMB → USD",
};

function formatRate(value: number): string {
  return value.toLocaleString("es-VE", { maximumFractionDigits: 4 });
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-VE", { maximumFractionDigits: 2 })} %`;
}

/**
 * Rates the server refused to apply on its own because they moved more than
 * ±15 % from the last stored rate (PLAN-2026-09-SECURITY-REMEDIATION F4.1).
 * Accepting stores the value; rejecting keeps the current rate.
 */
export function HeldRatesPanel() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { profile } = useCurrentUser();
  // Mirrors applyHeldRateApproval: accepting reprices, so owner/admin only.
  const canDecide = can(profile?.role, "pricing", "approve");
  const { data: held } = useQuery(trpc.pricing.heldRates.queryOptions());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: [["pricing"]] });
    await qc.invalidateQueries({ queryKey: [["dashboard"]] });
  };

  const approve = useMutation(
    trpc.approvals.approve.mutationOptions({
      onSuccess: () => toast.success("Tasa aceptada y registrada"),
      onError: (err) => toast.error(err.message),
      onSettled: refresh,
    }),
  );
  const reject = useMutation(
    trpc.approvals.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Tasa rechazada: se mantiene la anterior");
        setRejectingId(null);
        setReason("");
      },
      onError: (err) => toast.error(err.message),
      onSettled: refresh,
    }),
  );

  if (!held || held.length === 0) return null;

  return (
    <section
      aria-label="Tasas retenidas"
      className="border-border bg-status-warning-bg space-y-3 border p-4"
    >
      <div className="flex items-start gap-2">
        <Icons.Warning className="text-status-warning-fg mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-foreground text-sm font-medium">
            Tasas retenidas por una variación inusual
          </p>
          <p className="text-muted-foreground text-xs">
            Estos valores difieren más de 15 % de la última tasa registrada y no
            se aplicaron automáticamente. Revisa la fuente antes de aceptarlos.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {held.map((h) => (
          <li
            key={h.approvalId}
            className="border-border bg-card flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 text-sm">
              <p className="text-foreground font-medium">
                {RATE_LABELS[h.rateType] ?? h.rateType}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                {formatRate(h.previousRate)} → {formatRate(h.rate)} (
                {formatPercent(h.variationPct)}) · {h.provider} · {h.valueDate}
              </p>
            </div>

            {canDecide &&
              (rejectingId === h.approvalId ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    reject.mutate({ id: h.approvalId, reason: reason.trim() });
                  }}
                >
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Motivo del rechazo"
                    aria-label="Motivo del rechazo"
                    required
                    maxLength={1000}
                    className="border-border bg-background focus:border-primary w-full border px-3 py-1.5 text-sm focus:outline-none sm:w-56"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    disabled={reject.isPending || reason.trim().length === 0}
                  >
                    Rechazar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectingId(null)}
                  >
                    Cancelar
                  </Button>
                </form>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ id: h.approvalId })}
                  >
                    <Icons.Check className="size-3.5" />
                    Aceptar tasa
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectingId(h.approvalId)}
                  >
                    Rechazar
                  </Button>
                </div>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
