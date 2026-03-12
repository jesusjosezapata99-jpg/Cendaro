/**
 * Sync VES rates (official + parallel) to ExchangeRate table.
 *
 * Call this whenever the app loads a pricing-related page.
 * If today's rates aren't in the DB yet, it fetches from our
 * server-side proxy and inserts via `pricing.setRate`.
 */
export async function maybeSyncVesRates(opts: {
  latestRates:
    | { rateType: string; rate: number; createdAt: Date | null }[]
    | undefined;
  setRate: (input: {
    rateType: "bcv" | "parallel";
    rate: number;
    source: string;
  }) => Promise<unknown>;
}): Promise<void> {
  if (!opts.latestRates) return;

  const today = new Date().toISOString().split("T")[0];

  const bcvRate = opts.latestRates.find((r) => r.rateType === "bcv");
  const paraleloRate = opts.latestRates.find((r) => r.rateType === "parallel");

  const bcvDate = bcvRate?.createdAt
    ? new Date(bcvRate.createdAt).toISOString().split("T")[0]
    : null;
  const paraleloDate = paraleloRate?.createdAt
    ? new Date(paraleloRate.createdAt).toISOString().split("T")[0]
    : null;

  // Both already synced today
  if (bcvDate === today && paraleloDate === today) return;

  // Fetch from server-side proxy (avoids CORS)
  try {
    const res = await fetch("/api/bcv-rate", {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      oficial: { rate: number; date: string; source: string };
      paralelo: { rate: number; date: string; source: string };
    };

    // Sync oficial if needed
    if (bcvDate !== today && data.oficial.rate) {
      await opts.setRate({
        rateType: "bcv",
        rate: data.oficial.rate,
        source: `${data.oficial.source} (auto-sync ${data.oficial.date})`,
      });
    }

    // Sync paralelo if needed
    if (paraleloDate !== today && data.paralelo.rate) {
      await opts.setRate({
        rateType: "parallel",
        rate: data.paralelo.rate,
        source: `${data.paralelo.source} (auto-sync ${data.paralelo.date})`,
      });
    }
  } catch {
    // Silent fail — will use last known rates
  }
}

/**
 * Backwards-compatible wrapper.
 * Syncs only the official BCV rate (same behavior as before).
 */
export async function maybeSyncBcvRate(opts: {
  latestRates:
    | { rateType: string; rate: number; createdAt: Date | null }[]
    | undefined;
  setRate: (input: {
    rateType: "bcv";
    rate: number;
    source: string;
  }) => Promise<unknown>;
}): Promise<void> {
  return maybeSyncVesRates({
    latestRates: opts.latestRates,
    setRate: (input) => {
      // Only forward bcv rates through the legacy wrapper
      if (input.rateType === "bcv") {
        return opts.setRate({
          rateType: "bcv",
          rate: input.rate,
          source: input.source,
        });
      }
      return Promise.resolve();
    },
  });
}
