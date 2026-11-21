/**
 * Money is computed with @cendaro/validators, not with ad-hoc float rounding.
 * `toFixed` is still fine for text shown to a person.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = path.resolve(__dirname, "..");

/** Rounding of things that are not money. */
const ALLOWED = new Set([
  "modules/catalog-import.ts", // match score
  "modules/rate-sync.ts", // variation percentage
  "services/exchange-rate-sources.ts", // published spread
]);

const FLOAT_ROUNDING = [
  // toFixed inside the Number() call: Number(x).toFixed(2) only formats text.
  /Number\(\s*(?:[\w\s.+\-*/?[\]]|\((?:[\w\s.+\-*/?]|\([^()]*\))*\))*\.toFixed\(/,
  /Math\.round\([^;]*?\*\s*100\)\s*\/\s*100/,
];

const sources = ["modules", "services"].flatMap((folder) =>
  readdirSync(path.join(SOURCE, folder))
    .filter((name) => name.endsWith(".ts") && !name.includes(".test."))
    .map((name) => `${folder}/${name}`),
);

describe("money arithmetic", () => {
  it.each(sources.filter((source) => !ALLOWED.has(source)))(
    "%s does not round money by hand",
    (source) => {
      const text = readFileSync(path.join(SOURCE, source), "utf8");

      for (const pattern of FLOAT_ROUNDING) {
        expect(pattern.exec(text)?.[0]).toBeUndefined();
      }
    },
  );
});
