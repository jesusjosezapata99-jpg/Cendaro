/**
 * Cendaro — Official BCV rate for documents. The server always decides the
 * rate, and a stale or missing one stops the document instead of guessing.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import { ExchangeRate } from "@cendaro/db/schema";

/** BCV does not publish on weekends or holidays, so a week is the outer limit. */
const MAX_RATE_AGE_MS = 7 * 86_400_000;

export async function getOfficialBcvRate(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
): Promise<number> {
  const [latest] = await db
    .select({ rate: ExchangeRate.rate, createdAt: ExchangeRate.createdAt })
    .from(ExchangeRate)
    .where(
      and(
        eq(ExchangeRate.workspaceId, workspaceId),
        eq(ExchangeRate.rateType, "bcv"),
      ),
    )
    .orderBy(desc(ExchangeRate.createdAt))
    .limit(1);

  const rate = Number(latest?.rate ?? 0);
  const isFresh =
    latest && Date.now() - latest.createdAt.getTime() <= MAX_RATE_AGE_MS;
  if (!(rate > 0) || !isFresh) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "No hay una tasa BCV vigente: sincroniza las tasas antes de emitir este documento",
    });
  }
  return rate;
}
