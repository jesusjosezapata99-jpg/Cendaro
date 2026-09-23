import { describe, expect, it } from "vitest";

import {
  exceedsAutomaticRateDeviation,
  MAX_AUTOMATIC_RATE_DEVIATION,
  pickTrustedRate,
} from "../rates";

describe("exceedsAutomaticRateDeviation", () => {
  it("allows moves up to the limit in both directions", () => {
    expect(MAX_AUTOMATIC_RATE_DEVIATION).toBe(0.15);
    expect(exceedsAutomaticRateDeviation(114.9, 100)).toBe(false);
    expect(exceedsAutomaticRateDeviation(85.1, 100)).toBe(false);
  });

  it("flags moves beyond the limit", () => {
    expect(exceedsAutomaticRateDeviation(115.01, 100)).toBe(true);
    expect(exceedsAutomaticRateDeviation(84.99, 100)).toBe(true);
  });

  it("never flags against a missing or invalid reference", () => {
    expect(exceedsAutomaticRateDeviation(500, 0)).toBe(false);
    expect(exceedsAutomaticRateDeviation(500, Number.NaN)).toBe(false);
    expect(exceedsAutomaticRateDeviation(0, 100)).toBe(false);
  });
});

describe("pickTrustedRate", () => {
  it("uses the live rate while it stays within the limit", () => {
    expect(pickTrustedRate(846.5, 820)).toBe("live");
  });

  it("keeps the stored rate while a large move waits for approval", () => {
    expect(pickTrustedRate(960, 800)).toBe("stored");
    expect(pickTrustedRate(600, 800)).toBe("stored");
  });

  it("falls back to whichever rate exists", () => {
    expect(pickTrustedRate(846.5, undefined)).toBe("live");
    expect(pickTrustedRate(null, 800)).toBe("stored");
    expect(pickTrustedRate(0, 0)).toBe("none");
  });
});
