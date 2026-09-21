"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Icons } from "@cendaro/ui/icons";

import { useTRPC } from "~/trpc/client";

function daysRemaining(target: Date): number {
  const ms = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1_000)));
}

/**
 * F7.2 grace-period banner. Reads the same `mfaComplianceFor` decision the
 * server enforces in `workspaceProcedure`, so this never disagrees with what
 * actually gets blocked. Renders nothing once MFA is enrolled or not required
 * for the current role.
 */
export function MfaBanner() {
  const trpc = useTRPC();
  const { data: status } = useQuery(trpc.users.mfaStatus.queryOptions());
  const [dismissed, setDismissed] = useState(false);

  if (!status || status.enrolled) return null;
  if (!status.required) return null;
  if (!status.blocked && dismissed) return null;

  return (
    <div
      className={
        status.blocked
          ? "bg-status-destructive-bg text-status-destructive-fg flex items-center justify-between gap-3 px-4 py-2 text-sm md:px-8"
          : "bg-status-warning-bg text-status-warning-fg flex items-center justify-between gap-3 px-4 py-2 text-sm md:px-8"
      }
    >
      <div className="flex items-center gap-2">
        <Icons.Warning className="size-4 shrink-0" />
        <span>
          {status.blocked
            ? "Las acciones que modifican datos están bloqueadas: activa la autenticación de dos factores para continuar."
            : `Tu rol requiere autenticación de dos factores. Actívala en los próximos ${daysRemaining(status.gracePeriodEndsAt)} día(s).`}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link href="/settings/security" className="font-medium underline">
          Activar ahora
        </Link>
        {!status.blocked ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-current/70 hover:text-current"
            aria-label="Descartar"
          >
            <Icons.Close className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
