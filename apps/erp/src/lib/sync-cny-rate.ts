/**
 * Sync USD/CNY rate to ExchangeRate table.
 *
 * Call this whenever the app loads the Rates page.
 * If today's rmb_usd rate isn't in the DB yet, it fetches
 * from our server-side proxy and inserts via `pricing.setRate`.
 */
export async function maybeSyncCnyRate(opts: {
  latestRates:
    | { rateType: string; rate: number; createdAt: Date | null }[]
    | undefined;
  setRate: (input: {
    rateType: "rmb_usd";
    rate: number;
    source: string;
  }) => Promise<unknown>;
}): Promise<void> {
  if (!opts.latestRates) return;

  const cnyRate = opts.latestRates.find((r) => r.rateType === "rmb_usd");
  const today = new Date().toISOString().split("T")[0];
  const lastDate = cnyRate?.createdAt
    ? new Date(cnyRate.createdAt).toISOString().split("T")[0]
    : null;

  // Already have today's rate
  if (lastDate === today) return;

  // Fetch from server-side proxy
  try {
    const res = await fetch("/api/exchange/usd-cny", {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      rate: number;
      date: string;
      source: string;
    };
    if (!data.rate) return;

    await opts.setRate({
      rateType: "rmb_usd",
      rate: data.rate,
      source: `${data.source} (auto-sync ${data.date})`,
    });
  } catch {
    // Silent fail — will use last known rate
  }
}
