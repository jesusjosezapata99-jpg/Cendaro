/**
 * Cendaro — Automatic exchange-rate sync (PLAN-2026-09-SECURITY-REMEDIATION F4.1)
 *
 * Replaces pricing.setRate, where the browser sent the rate together with a
 * `source` string that was the only "control" (any `dolarapi-*` prefix was
 * accepted, while the real BCV source `bcv-direct` was silently rejected).
 * The server now fetches every rate itself (services/exchange-rate-sources)
 * and stores it here:
 *  - at most one automatic row per rate type and UTC day unless the value
 *    changes, serialized per workspace and rate type by an advisory lock;
 *  - a value more than MAX_AUTOMATIC_RATE_DEVIATION away from the last stored
 *    rate is NOT applied. It is held as a `price_change` approval on entity
 *    `exchange_rate` (24 h window, PRD §12) plus a dashboard alert, so a
 *    broken scraper or a poisoned upstream cannot reprice the catalog.
 *    approvals.approve applies it through applyHeldRateApproval.
 * Approvals on `exchange_rate` are reserved to this module (approvals.request
 * refuses the entity type). The member whose sync opened one is not its
 * author — the value came from the upstream — so segregation of duties is
 * enforced by role instead: only owner/admin (pricing.approve) may accept.
 * Upstream throttling (services/exchange-rate-sources) is per instance.
 */
import crypto from "node:crypto";
import type { SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { getDb } from "@cendaro/db/client";
import {
  Approval,
  ExchangeRate,
  SystemAlert,
  Workspace,
  WorkspaceModule,
} from "@cendaro/db/schema";
import { can, MAX_AUTOMATIC_RATE_DEVIATION } from "@cendaro/validators";

import type { UpstreamRate, VesRates } from "../services/exchange-rate-sources";
import type { createTRPCContext, WorkspaceActor } from "../trpc";
import { logger } from "../logger";
import { getUsdCnyRate, getVesRates } from "../services/exchange-rate-sources";
import { runInWorkspaceRls } from "../trpc";
import { logAudit } from "./audit";

type Db = ReturnType<typeof createTRPCContext>["db"];

/** Shared with the browser (plan decision 6), which applies the same limit. */
export { MAX_AUTOMATIC_RATE_DEVIATION };
/** PRD §12: a held repricing decision expires after 24 h. */
export const HELD_RATE_TTL_MS = 24 * 60 * 60 * 1000;
/** Approval entity type reserved to this module. */
export const HELD_RATE_ENTITY = "exchange_rate";

const AUTOMATIC_RATE_TYPES = ["bcv", "parallel", "rmb_usd"] as const;
export type AutomaticRateType = (typeof AUTOMATIC_RATE_TYPES)[number];

const RATE_LABELS: Record<AutomaticRateType, string> = {
  bcv: "BCV",
  parallel: "paralela",
  rmb_usd: "USD/CNY",
};

/** Relative tolerance under which two rates are the same value. */
const SAME_RATE_TOLERANCE = 1e-9;

// ── Pure decisions ───────────────────────────────

export interface RateCandidate {
  rateType: AutomaticRateType;
  rate: number;
  /** Upstream provider id (e.g. "bcv-direct", "frankfurter"). */
  provider: string;
  /** Upstream value date, YYYY-MM-DD. */
  valueDate: string;
}

export interface StoredRate {
  rate: number;
  createdAt: Date;
}

export type RateDecision =
  | { action: "insert" }
  | { action: "unchanged" }
  | { action: "hold"; variation: number };

function sameRate(a: number, b: number): boolean {
  return (
    Math.abs(a - b) <= SAME_RATE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b))
  );
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 0.1625 → 16.25 */
function toPercent(variation: number): number {
  return Math.round(variation * 10_000) / 100;
}

function formatRate(rate: number): string {
  return rate.toLocaleString("es-VE", { maximumFractionDigits: 4 });
}

function formatPercent(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("es-VE", { maximumFractionDigits: 2 })} %`;
}

/**
 * `anchor` is the latest rate stored at least 24 h ago. Comparing against it
 * too stops a poisoned upstream from walking the rate up in steps just under
 * the limit (14.9 % per sync would triple it in a couple of hours).
 */
export function decideAutomaticRate(
  latest: StoredRate | undefined,
  candidate: RateCandidate,
  now: Date,
  anchor?: StoredRate,
): RateDecision {
  if (!latest || latest.rate <= 0) return { action: "insert" };
  const variation = candidate.rate / latest.rate - 1;
  const drift =
    anchor && anchor.rate > 0 ? candidate.rate / anchor.rate - 1 : 0;
  if (Math.abs(variation) > MAX_AUTOMATIC_RATE_DEVIATION) {
    return { action: "hold", variation };
  }
  if (Math.abs(drift) > MAX_AUTOMATIC_RATE_DEVIATION) {
    return { action: "hold", variation: drift };
  }
  if (
    sameRate(candidate.rate, latest.rate) &&
    utcDay(latest.createdAt) === utcDay(now)
  ) {
    return { action: "unchanged" };
  }
  return { action: "insert" };
}

export const heldRateMetadataSchema = z.object({
  origin: z.literal("rate-sync"),
  rateType: z.enum(AUTOMATIC_RATE_TYPES),
  rate: z.number().positive(),
  previousRate: z.number().positive(),
  variationPct: z.number(),
  provider: z.string().max(64),
  valueDate: z.string().max(10),
});
export type HeldRateMetadata = z.infer<typeof heldRateMetadataSchema>;

/** The held rate behind an approval, or null for any other approval. */
export function parseHeldRate(approval: {
  entityType: string;
  metadata: unknown;
}): HeldRateMetadata | null {
  if (approval.entityType !== HELD_RATE_ENTITY) return null;
  const parsed = heldRateMetadataSchema.safeParse(approval.metadata);
  return parsed.success ? parsed.data : null;
}

export interface ExistingHeldRate {
  id: string;
  status: "pending" | "rejected";
  rate: number;
  resolvedAt: Date | null;
  expiresAt: Date | null;
}

export type HeldRatePlan =
  | { kind: "reuse"; approvalId: string }
  | { kind: "rejected"; approvalId: string }
  | { kind: "create"; supersede: string[] };

/**
 * One live request per rate type: reuse it for the same value, replace it for
 * a new one, and do not reopen a value a person rejected in the last 24 h.
 */
export function planHeldRate(
  existing: readonly ExistingHeldRate[],
  rate: number,
  now: Date,
): HeldRatePlan {
  const pendingSame = existing.find(
    (e) =>
      e.status === "pending" &&
      (e.expiresAt === null || e.expiresAt.getTime() > now.getTime()) &&
      sameRate(e.rate, rate),
  );
  if (pendingSame) return { kind: "reuse", approvalId: pendingSame.id };

  const rejectedSame = existing.find(
    (e) =>
      e.status === "rejected" &&
      e.resolvedAt !== null &&
      now.getTime() - e.resolvedAt.getTime() <= HELD_RATE_TTL_MS &&
      sameRate(e.rate, rate),
  );
  if (rejectedSame) return { kind: "rejected", approvalId: rejectedSame.id };

  return {
    kind: "create",
    supersede: existing.filter((e) => e.status === "pending").map((e) => e.id),
  };
}

/** Rates worth storing; the estimated parallel rate is display-only. */
export function toRateCandidates(
  ves: VesRates | null,
  cny: UpstreamRate | null,
): RateCandidate[] {
  const candidates: RateCandidate[] = [];
  if (ves) {
    candidates.push({
      rateType: "bcv",
      rate: ves.oficial.rate,
      provider: ves.oficial.source,
      valueDate: ves.oficial.date,
    });
    if (!ves.paralelo.estimated) {
      candidates.push({
        rateType: "parallel",
        rate: ves.paralelo.rate,
        provider: ves.paralelo.source,
        valueDate: ves.paralelo.date,
      });
    }
  }
  if (cny) {
    candidates.push({
      rateType: "rmb_usd",
      rate: cny.rate,
      provider: cny.source,
      valueDate: cny.date,
    });
  }
  return candidates;
}

// ── Database operations ──────────────────────────

function heldRateScope(workspaceId: string): SQL | undefined {
  return and(
    eq(Approval.workspaceId, workspaceId),
    eq(Approval.approvalType, "price_change"),
    eq(Approval.entityType, HELD_RATE_ENTITY),
  );
}

async function lockRateType(
  db: Db,
  workspaceId: string,
  rateType: AutomaticRateType,
): Promise<void> {
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`exchange_rate:${workspaceId}:${rateType}`}, 0))`,
  );
}

/**
 * Takes the rate-type lock of a held-rate approval before approvals.ts locks
 * the approval row. The sync takes the same two locks in this order (rate
 * type, then approval rows), so resolving and syncing cannot deadlock.
 * No-op for any other approval.
 */
export async function lockHeldRateApproval(
  db: Db,
  workspaceId: string,
  approvalId: string,
): Promise<void> {
  const [approval] = await db
    .select({ entityType: Approval.entityType, metadata: Approval.metadata })
    .from(Approval)
    .where(
      and(eq(Approval.id, approvalId), eq(Approval.workspaceId, workspaceId)),
    )
    .limit(1);
  const held = approval ? parseHeldRate(approval) : null;
  if (held) await lockRateType(db, workspaceId, held.rateType);
}

/** Latest stored rate of a type, optionally only among rows created before `before`. */
async function latestStoredRate(
  db: Db,
  workspaceId: string,
  rateType: AutomaticRateType,
  before?: Date,
): Promise<StoredRate | undefined> {
  const [row] = await db
    .select({ rate: ExchangeRate.rate, createdAt: ExchangeRate.createdAt })
    .from(ExchangeRate)
    .where(
      and(
        eq(ExchangeRate.workspaceId, workspaceId),
        eq(ExchangeRate.rateType, rateType),
        before ? lt(ExchangeRate.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(ExchangeRate.createdAt))
    .limit(1);
  return row;
}

/**
 * Closes the "Tasa … retenida" alerts the scheduled job opened for a rate
 * type (they point at no approval), once that rate is stored or reviewed.
 */
export async function dismissRateTypeAlerts(
  db: Db,
  workspaceId: string,
  rateType: AutomaticRateType,
  actor: WorkspaceActor | null,
  now: Date,
): Promise<void> {
  await db
    .update(SystemAlert)
    .set({
      isDismissed: true,
      dismissedBy: actor?.id ?? null,
      dismissedAt: now,
    })
    .where(
      and(
        eq(SystemAlert.workspaceId, workspaceId),
        eq(SystemAlert.alertType, "rate_change"),
        eq(SystemAlert.entityType, HELD_RATE_ENTITY),
        eq(SystemAlert.title, heldAlertTitle(rateType)),
        eq(SystemAlert.isDismissed, false),
      ),
    );
}

function heldAlertTitle(rateType: AutomaticRateType): string {
  return `Tasa ${RATE_LABELS[rateType]} retenida`;
}

async function loadHeldRates(
  db: Db,
  workspaceId: string,
  rateType: AutomaticRateType,
  now: Date,
): Promise<ExistingHeldRate[]> {
  const rows = await db
    .select({
      id: Approval.id,
      status: Approval.status,
      entityType: Approval.entityType,
      metadata: Approval.metadata,
      resolvedAt: Approval.resolvedAt,
      expiresAt: Approval.expiresAt,
    })
    .from(Approval)
    .where(
      and(
        heldRateScope(workspaceId),
        sql`${Approval.metadata} ->> 'rateType' = ${rateType}`,
        or(
          eq(Approval.status, "pending"),
          and(
            eq(Approval.status, "rejected"),
            gt(Approval.resolvedAt, new Date(now.getTime() - HELD_RATE_TTL_MS)),
          ),
        ),
      ),
    );

  return rows.flatMap((row) => {
    const held = parseHeldRate(row);
    if (!held || (row.status !== "pending" && row.status !== "rejected")) {
      return [];
    }
    return [
      {
        id: row.id,
        status: row.status,
        rate: held.rate,
        resolvedAt: row.resolvedAt,
        expiresAt: row.expiresAt,
      },
    ];
  });
}

/** Dismisses the dashboard alerts that point at these approvals. */
export async function dismissApprovalAlerts(
  db: Db,
  workspaceId: string,
  approvalIds: readonly string[],
  actor: WorkspaceActor | null,
  now: Date,
): Promise<void> {
  if (approvalIds.length === 0) return;
  await db
    .update(SystemAlert)
    .set({
      isDismissed: true,
      dismissedBy: actor?.id ?? null,
      dismissedAt: now,
    })
    .where(
      and(
        eq(SystemAlert.workspaceId, workspaceId),
        eq(SystemAlert.entityType, "approval"),
        inArray(SystemAlert.entityId, [...approvalIds]),
      ),
    );
}

/** Marks pending held-rate approvals matching `condition` as expired. */
async function expireHeldApprovals(
  db: Db,
  workspaceId: string,
  condition: SQL,
  actor: WorkspaceActor | null,
  now: Date,
): Promise<void> {
  const expired = await db
    .update(Approval)
    .set({ status: "expired", resolvedAt: now })
    .where(
      and(
        heldRateScope(workspaceId),
        eq(Approval.status, "pending"),
        condition,
      ),
    )
    .returning({ id: Approval.id });
  await dismissApprovalAlerts(
    db,
    workspaceId,
    expired.map((e) => e.id),
    actor,
    now,
  );
}

async function raiseRateAlert(
  db: Db,
  workspaceId: string,
  candidate: RateCandidate,
  previousRate: number,
  variationPct: number,
  approvalId: string | null,
  now: Date,
): Promise<void> {
  const title = heldAlertTitle(candidate.rateType);
  if (!approvalId) {
    // Scheduled runs have no approval to point at: one open alert per rate
    // type and day is enough.
    const [open] = await db
      .select({ id: SystemAlert.id })
      .from(SystemAlert)
      .where(
        and(
          eq(SystemAlert.workspaceId, workspaceId),
          eq(SystemAlert.alertType, "rate_change"),
          eq(SystemAlert.title, title),
          eq(SystemAlert.isDismissed, false),
          gt(SystemAlert.createdAt, new Date(now.getTime() - HELD_RATE_TTL_MS)),
        ),
      )
      .limit(1);
    if (open) return;
  }

  await db.insert(SystemAlert).values({
    workspaceId,
    alertType: "rate_change",
    title,
    message: `Se recibió ${formatRate(candidate.rate)} y la última registrada es ${formatRate(previousRate)} (${formatPercent(variationPct)}). No se aplicó automáticamente: revísala en Tasas.`,
    severity: "high",
    entityType: approvalId ? "approval" : HELD_RATE_ENTITY,
    entityId: approvalId,
  });
}

async function storeAutomaticRate(
  db: Db,
  actor: WorkspaceActor | null,
  workspaceId: string,
  candidate: RateCandidate,
  latest: StoredRate | undefined,
  now: Date,
): Promise<void> {
  const [row] = await db
    .insert(ExchangeRate)
    .values({
      workspaceId,
      rateType: candidate.rateType,
      rate: candidate.rate,
      source: `${candidate.provider} (auto-sync ${candidate.valueDate})`,
      updatedBy: actor?.id ?? null,
    })
    .returning({ id: ExchangeRate.id });

  // A value back within tolerance makes a held (anomalous) value obsolete.
  await expireHeldApprovals(
    db,
    workspaceId,
    sql`${Approval.metadata} ->> 'rateType' = ${candidate.rateType}`,
    actor,
    now,
  );
  await dismissRateTypeAlerts(db, workspaceId, candidate.rateType, actor, now);

  await logAudit(db, actor, {
    workspaceId,
    action: "rate.sync",
    entity: "exchange_rate",
    entityId: row?.id,
    oldValue: latest ? { rate: latest.rate } : undefined,
    newValue: {
      rateType: candidate.rateType,
      rate: candidate.rate,
      provider: candidate.provider,
      valueDate: candidate.valueDate,
    },
  });
}

async function holdRate(
  db: Db,
  actor: WorkspaceActor | null,
  workspaceId: string,
  candidate: RateCandidate,
  latest: StoredRate,
  variation: number,
  now: Date,
): Promise<RateSyncResult> {
  const variationPct = toPercent(variation);
  const base = {
    rateType: candidate.rateType,
    rate: candidate.rate,
    variationPct,
  };

  const plan = planHeldRate(
    await loadHeldRates(db, workspaceId, candidate.rateType, now),
    candidate.rate,
    now,
  );
  if (plan.kind === "reuse") {
    return { ...base, status: "held", approvalId: plan.approvalId };
  }
  if (plan.kind === "rejected") {
    return { ...base, status: "rejected", approvalId: plan.approvalId };
  }
  if (plan.supersede.length > 0) {
    await expireHeldApprovals(
      db,
      workspaceId,
      inArray(Approval.id, plan.supersede),
      actor,
      now,
    );
  }

  const held: HeldRateMetadata = {
    origin: "rate-sync",
    rateType: candidate.rateType,
    rate: candidate.rate,
    previousRate: latest.rate,
    variationPct,
    provider: candidate.provider,
    valueDate: candidate.valueDate,
  };

  // An approval needs a requesting member, so scheduled runs (no actor) only
  // alert; the next sync by someone with rates.update opens the approval.
  let approvalId: string | null = null;
  if (actor) {
    const [approval] = await db
      .insert(Approval)
      .values({
        workspaceId,
        approvalType: "price_change",
        entityType: HELD_RATE_ENTITY,
        // Id the rate row takes once accepted (applyHeldRateApproval).
        entityId: crypto.randomUUID(),
        requestedBy: actor.id,
        reason: `La tasa ${RATE_LABELS[candidate.rateType]} recibida difiere ${formatPercent(variationPct)} de la última registrada`,
        metadata: held,
        expiresAt: new Date(now.getTime() + HELD_RATE_TTL_MS),
      })
      .returning({ id: Approval.id });
    approvalId = approval?.id ?? null;
    // The approval's own alert replaces the one a scheduled run opened.
    await dismissRateTypeAlerts(
      db,
      workspaceId,
      candidate.rateType,
      actor,
      now,
    );
  }

  await raiseRateAlert(
    db,
    workspaceId,
    candidate,
    latest.rate,
    variationPct,
    approvalId,
    now,
  );
  await logAudit(db, actor, {
    workspaceId,
    action: "rate.hold",
    entity: approvalId ? "approval" : "exchange_rate",
    entityId: approvalId ?? undefined,
    newValue: held,
  });

  return { ...base, status: "held", approvalId };
}

export interface RateSyncResult {
  rateType: AutomaticRateType;
  status: "inserted" | "unchanged" | "held" | "rejected";
  rate: number;
  /** Move from the last stored rate in percent (held/rejected only). */
  variationPct: number | null;
  approvalId: string | null;
}

/**
 * Stores upstream rates for one workspace. Must run inside that workspace's
 * RLS transaction (runInWorkspaceRls): the advisory locks and the writes all
 * belong to it. `actor` is null for the scheduled job.
 */
export async function syncAutomaticRates(
  db: Db,
  actor: WorkspaceActor | null,
  workspaceId: string,
  candidates: readonly RateCandidate[],
  now: Date = new Date(),
): Promise<RateSyncResult[]> {
  const results: RateSyncResult[] = [];
  for (const candidate of candidates) {
    await lockRateType(db, workspaceId, candidate.rateType);
    const latest = await latestStoredRate(db, workspaceId, candidate.rateType);
    const anchor = await latestStoredRate(
      db,
      workspaceId,
      candidate.rateType,
      new Date(now.getTime() - HELD_RATE_TTL_MS),
    );
    const decision = decideAutomaticRate(latest, candidate, now, anchor);

    if (decision.action === "unchanged") {
      results.push({
        rateType: candidate.rateType,
        rate: candidate.rate,
        status: "unchanged",
        variationPct: null,
        approvalId: null,
      });
    } else if (decision.action === "insert" || !latest) {
      await storeAutomaticRate(db, actor, workspaceId, candidate, latest, now);
      results.push({
        rateType: candidate.rateType,
        rate: candidate.rate,
        status: "inserted",
        variationPct: null,
        approvalId: null,
      });
    } else {
      results.push(
        await holdRate(
          db,
          actor,
          workspaceId,
          candidate,
          latest,
          decision.variation,
          now,
        ),
      );
    }
  }
  return results;
}

/**
 * Stores a held rate once a person accepts it (called by approvals.approve
 * after it marked the approval approved). Refused when a newer rate was
 * stored after the request: accepting an old anomaly would overwrite it.
 */
export async function applyHeldRateApproval(
  db: Db,
  actor: WorkspaceActor,
  workspaceId: string,
  approval: { id: string; entityId: string; requestedAt: Date },
  held: HeldRateMetadata,
  now: Date = new Date(),
): Promise<void> {
  // Accepting an anomalous rate reprices the catalog, and repricing approval
  // is owner/admin (pricing.approve). A supervisor can trigger the sync that
  // holds the rate, but a second, more senior person decides on it.
  if (!can(actor.workspaceRole, "pricing", "approve")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo dueños y administradores pueden aceptar una tasa retenida",
    });
  }

  await lockRateType(db, workspaceId, held.rateType);
  const [newer] = await db
    .select({ id: ExchangeRate.id })
    .from(ExchangeRate)
    .where(
      and(
        eq(ExchangeRate.workspaceId, workspaceId),
        eq(ExchangeRate.rateType, held.rateType),
        gt(ExchangeRate.createdAt, approval.requestedAt),
      ),
    )
    .limit(1);
  if (newer) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "La tasa cambió después de esta solicitud. Vuelve a sincronizar las tasas.",
    });
  }

  await db.insert(ExchangeRate).values({
    id: approval.entityId,
    workspaceId,
    rateType: held.rateType,
    rate: held.rate,
    source: `${held.provider} (auto-sync ${held.valueDate}, aceptada)`,
    notes: `Aceptada tras un desvío de ${formatPercent(held.variationPct)} sobre ${formatRate(held.previousRate)}`,
    updatedBy: actor.id,
  });
  await dismissApprovalAlerts(db, workspaceId, [approval.id], actor, now);
  await dismissRateTypeAlerts(db, workspaceId, held.rateType, actor, now);
  await logAudit(db, actor, {
    workspaceId,
    action: "rate.update",
    entity: "exchange_rate",
    entityId: approval.entityId,
    oldValue: { rate: held.previousRate },
    newValue: {
      rateType: held.rateType,
      rate: held.rate,
      approvalId: approval.id,
    },
  });
}

export interface HeldRate {
  approvalId: string;
  rateType: AutomaticRateType;
  rate: number;
  previousRate: number;
  variationPct: number;
  provider: string;
  valueDate: string;
  requestedAt: Date;
  expiresAt: Date | null;
}

/**
 * Held rates still waiting for a decision: pending, not expired, and not made
 * obsolete by a rate stored after the request.
 */
export async function listHeldRates(
  db: Db,
  workspaceId: string,
  now: Date = new Date(),
): Promise<HeldRate[]> {
  const rows = await db
    .select({
      id: Approval.id,
      entityType: Approval.entityType,
      metadata: Approval.metadata,
      requestedAt: Approval.requestedAt,
      expiresAt: Approval.expiresAt,
    })
    .from(Approval)
    .where(
      and(
        heldRateScope(workspaceId),
        eq(Approval.status, "pending"),
        or(isNull(Approval.expiresAt), gt(Approval.expiresAt, now)),
      ),
    )
    .orderBy(desc(Approval.requestedAt))
    .limit(20);
  if (rows.length === 0) return [];

  const latest = await db
    .select({
      rateType: ExchangeRate.rateType,
      createdAt: sql<Date | string>`max(${ExchangeRate.createdAt})`,
    })
    .from(ExchangeRate)
    .where(eq(ExchangeRate.workspaceId, workspaceId))
    .groupBy(ExchangeRate.rateType);
  const latestByType = new Map(
    latest.map((r) => [r.rateType, new Date(r.createdAt).getTime()]),
  );

  return rows.flatMap((row) => {
    const held = parseHeldRate(row);
    if (!held) return [];
    const newest = latestByType.get(held.rateType);
    if (newest !== undefined && newest > row.requestedAt.getTime()) return [];
    return [
      {
        approvalId: row.id,
        rateType: held.rateType,
        rate: held.rate,
        previousRate: held.previousRate,
        variationPct: held.variationPct,
        provider: held.provider,
        valueDate: held.valueDate,
        requestedAt: row.requestedAt,
        expiresAt: row.expiresAt,
      },
    ];
  });
}

// ── Scheduled job ────────────────────────────────

export interface ScheduledRateSyncSummary {
  upstream: { ves: boolean; cny: boolean };
  workspaces: {
    workspaceId: string;
    /** null when this workspace failed (logged). */
    results:
      | { rateType: AutomaticRateType; status: RateSyncResult["status"] }[]
      | null;
  }[];
}

/**
 * Daily job behind /api/cron/sync-rates: fetches the upstream rates once, then
 * stores them for every active workspace with the `rates` module, each inside
 * its own RLS transaction. One failing workspace does not stop the others.
 */
export async function runScheduledRateSync(): Promise<ScheduledRateSyncSummary> {
  const [ves, cny] = await Promise.all([
    getVesRates({ fresh: true }),
    getUsdCnyRate({ fresh: true }),
  ]);
  const candidates = toRateCandidates(ves, cny);
  const summary: ScheduledRateSyncSummary = {
    upstream: { ves: ves !== null, cny: cny !== null },
    workspaces: [],
  };
  if (candidates.length === 0) return summary;

  const db = getDb();
  const workspaces = await db
    .select({ id: Workspace.id })
    .from(Workspace)
    .innerJoin(
      WorkspaceModule,
      and(
        eq(WorkspaceModule.workspaceId, Workspace.id),
        eq(WorkspaceModule.module, "rates"),
      ),
    )
    .where(eq(Workspace.status, "active"));

  for (const { id } of workspaces) {
    try {
      const results = await runInWorkspaceRls(db, id, (tx) =>
        syncAutomaticRates(tx, null, id, candidates),
      );
      summary.workspaces.push({
        workspaceId: id,
        results: results.map(({ rateType, status }) => ({ rateType, status })),
      });
    } catch (error) {
      logger.error("scheduled rate sync failed", { workspaceId: id }, error);
      summary.workspaces.push({ workspaceId: id, results: null });
    }
  }
  return summary;
}
