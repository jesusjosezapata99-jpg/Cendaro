"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { can } from "@cendaro/validators";

import { useCurrentUser } from "~/hooks/use-current-user";
import { useTRPC } from "~/trpc/client";

/**
 * Server-side exchange-rate refresh (PLAN-2026-09-SECURITY-REMEDIATION F4.1).
 *
 * The server fetches and stores the rates itself (`pricing.syncRates`); the
 * browser only asks for it and can no longer send a rate. With `auto`, it
 * asks once per mount — only for roles holding rates.update, so other
 * members never trigger a denied call.
 */
export function useSyncRates(options: { auto: boolean }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { profile } = useCurrentUser();
  const canSync = can(profile?.role, "rates", "update");

  const mutation = useMutation(
    trpc.pricing.syncRates.mutationOptions({
      onSuccess: async (data) => {
        // Seed the proxy caches (same shapes as /api/bcv-rate and
        // /api/exchange/usd-cny) only with values the server accepted; a held
        // or rejected rate stays out, and the hooks keep the stored one.
        const notStored = new Set(
          data.results
            .filter((r) => r.status === "held" || r.status === "rejected")
            .map((r) => r.rateType),
        );
        if (
          data.live.ves &&
          !notStored.has("bcv") &&
          !notStored.has("parallel")
        ) {
          qc.setQueryData(["ves-rates-proxy"], data.live.ves);
        }
        if (data.live.cny && !notStored.has("rmb_usd")) {
          qc.setQueryData(["cny-rate-proxy"], data.live.cny);
        }
        await qc.invalidateQueries({ queryKey: [["pricing"]] });
      },
    }),
  );

  const { mutateAsync } = mutation;
  const sync = useCallback(
    (force: boolean) => mutateAsync({ force }),
    [mutateAsync],
  );

  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  useEffect(() => {
    if (options.auto && canSync) mutateRef.current({ force: false });
  }, [options.auto, canSync]);

  return {
    canSync,
    /** `force` asks the server for fresh upstream values (throttled server-side). */
    sync,
    isSyncing: mutation.isPending,
    lastResult: mutation.data,
  };
}
