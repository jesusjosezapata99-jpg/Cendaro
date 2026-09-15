/**
 * Cendaro — Users: UI Preferences Unit Tests (T3.2)
 *
 * Covers the `UiPreferencesSchema` input validation used by
 * `users.updateUiPreferences`. Not covered here (needs a live Postgres,
 * which this workspace has no test-DB harness for yet): the actual
 * merge-on-server behavior, or that reads/writes are always scoped to
 * `ctx.user.id`. That is verified by static review instead — both
 * `uiPreferences` and `updateUiPreferences` in `./users.ts` filter with
 * `eq(UserProfile.id, ctx.user.id)`, never an id taken from the input.
 */
import { describe, expect, it } from "vitest";

import { UiPreferencesSchema } from "@cendaro/validators";

describe("UiPreferencesSchema", () => {
  it("accepts an empty object (no preferences set yet)", () => {
    expect(UiPreferencesSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid dashboard order/hidden list", () => {
    const result = UiPreferencesSchema.safeParse({
      dashboard: {
        order: ["sales", "grossProfit", "lowStock"],
        hidden: ["receivables"],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown widget id", () => {
    const result = UiPreferencesSchema.safeParse({
      dashboard: { order: ["not_a_real_widget"], hidden: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 16 widgets in order", () => {
    const result = UiPreferencesSchema.safeParse({
      dashboard: {
        order: Array(17).fill("sales"),
        hidden: [],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 16 widgets in hidden", () => {
    const result = UiPreferencesSchema.safeParse({
      dashboard: {
        order: [],
        hidden: Array(17).fill("lowStock"),
      },
    });
    expect(result.success).toBe(false);
  });
});
