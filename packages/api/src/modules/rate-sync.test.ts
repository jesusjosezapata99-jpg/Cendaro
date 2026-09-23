/**
 * Automatic exchange-rate decisions (PLAN-2026-09-SECURITY-REMEDIATION F4.1).
 *
 * The server decides whether an upstream value is stored, ignored as a
 * duplicate, or held for a human because it moved more than ±15 % from the
 * last stored rate (plan decision 6; PRD §12: 24 h approval window).
 */
import { describe, expect, it } from "vitest";

import type { ExistingHeldRate, RateCandidate } from "./rate-sync";
import {
  decideAutomaticRate,
  HELD_RATE_TTL_MS,
  parseHeldRate,
  planHeldRate,
  toRateCandidates,
} from "./rate-sync";

const NOW = new Date("2026-09-19T15:00:00Z");

function candidate(rate: number): RateCandidate {
  return {
    rateType: "bcv",
    rate,
    provider: "bcv-direct",
    valueDate: "2026-09-19",
  };
}

describe("decideAutomaticRate", () => {
  it("stores the first rate of a type", () => {
    expect(decideAutomaticRate(undefined, candidate(846), NOW)).toEqual({
      action: "insert",
    });
  });

  it("ignores the same value already stored today", () => {
    const latest = {
      rate: 846.5131,
      createdAt: new Date("2026-09-19T09:00:00Z"),
    };
    expect(decideAutomaticRate(latest, candidate(846.5131), NOW)).toEqual({
      action: "unchanged",
    });
  });

  it("keeps one snapshot per day even when the value did not move", () => {
    const latest = {
      rate: 846.5131,
      createdAt: new Date("2026-09-18T22:00:00Z"),
    };
    expect(decideAutomaticRate(latest, candidate(846.5131), NOW)).toEqual({
      action: "insert",
    });
  });

  it("stores a normal intraday change", () => {
    const latest = { rate: 846, createdAt: new Date("2026-09-19T09:00:00Z") };
    expect(decideAutomaticRate(latest, candidate(850), NOW)).toEqual({
      action: "insert",
    });
  });

  it("accepts a move of exactly 15 %", () => {
    const latest = { rate: 800, createdAt: new Date("2026-09-18T09:00:00Z") };
    expect(decideAutomaticRate(latest, candidate(920), NOW).action).toBe(
      "insert",
    );
  });

  it("holds a jump beyond 15 % in either direction", () => {
    const latest = { rate: 800, createdAt: new Date("2026-09-18T09:00:00Z") };

    const up = decideAutomaticRate(latest, candidate(930), NOW);
    expect(up.action).toBe("hold");
    expect(up.action === "hold" && up.variation).toBeCloseTo(0.1625, 6);

    const down = decideAutomaticRate(latest, candidate(600), NOW);
    expect(down.action === "hold" && down.variation).toBeCloseTo(-0.25, 6);
  });
});

describe("planHeldRate", () => {
  const hour = 60 * 60 * 1000;

  function held(overrides: Partial<ExistingHeldRate>): ExistingHeldRate {
    return {
      id: "held-1",
      status: "pending",
      rate: 1000,
      resolvedAt: null,
      expiresAt: new Date(NOW.getTime() + hour),
      ...overrides,
    };
  }

  it("reuses a pending request for the same value", () => {
    expect(planHeldRate([held({})], 1000, NOW)).toEqual({
      kind: "reuse",
      approvalId: "held-1",
    });
  });

  it("replaces a pending request for another value", () => {
    expect(planHeldRate([held({ rate: 990 })], 1000, NOW)).toEqual({
      kind: "create",
      supersede: ["held-1"],
    });
  });

  it("replaces a pending request that already expired", () => {
    const expired = held({ expiresAt: new Date(NOW.getTime() - 1) });
    expect(planHeldRate([expired], 1000, NOW)).toEqual({
      kind: "create",
      supersede: ["held-1"],
    });
  });

  it("does not reopen a value rejected in the last 24 h", () => {
    const rejected = held({
      status: "rejected",
      resolvedAt: new Date(NOW.getTime() - hour),
    });
    expect(planHeldRate([rejected], 1000, NOW)).toEqual({
      kind: "rejected",
      approvalId: "held-1",
    });
  });

  it("asks again once the rejection is older than 24 h", () => {
    const rejected = held({
      status: "rejected",
      resolvedAt: new Date(NOW.getTime() - HELD_RATE_TTL_MS - 1),
    });
    expect(planHeldRate([rejected], 1000, NOW)).toEqual({
      kind: "create",
      supersede: [],
    });
  });
});

describe("toRateCandidates", () => {
  it("never stores the estimated parallel rate", () => {
    const candidates = toRateCandidates(
      {
        oficial: {
          rate: 846,
          date: "2026-09-19",
          dateText: "Viernes",
          source: "bcv-direct",
        },
        euro: null,
        paralelo: {
          rate: 972.9,
          date: "2026-09-19",
          source: "estimated-fallback",
          estimated: true,
        },
        spread: { absolute: 126.9, percentage: 15 },
        timestamp: NOW.toISOString(),
      },
      { rate: 7.1, date: "2026-09-18", source: "frankfurter" },
    );

    expect(candidates).toEqual([
      {
        rateType: "bcv",
        rate: 846,
        provider: "bcv-direct",
        valueDate: "2026-09-19",
      },
      {
        rateType: "rmb_usd",
        rate: 7.1,
        provider: "frankfurter",
        valueDate: "2026-09-18",
      },
    ]);
  });

  it("returns nothing when every upstream failed", () => {
    expect(toRateCandidates(null, null)).toEqual([]);
  });
});

describe("parseHeldRate", () => {
  const metadata = {
    origin: "rate-sync",
    rateType: "bcv",
    rate: 1000,
    previousRate: 846,
    variationPct: 18.2,
    provider: "bcv-direct",
    valueDate: "2026-09-19",
  };

  it("reads a held rate created by the sync", () => {
    expect(
      parseHeldRate({ entityType: "exchange_rate", metadata }),
    ).toMatchObject({ rateType: "bcv", rate: 1000 });
  });

  it("ignores other approvals and malformed metadata", () => {
    expect(parseHeldRate({ entityType: "sales_order", metadata })).toBeNull();
    expect(
      parseHeldRate({
        entityType: "exchange_rate",
        metadata: { ...metadata, rate: -1 },
      }),
    ).toBeNull();
  });
});
