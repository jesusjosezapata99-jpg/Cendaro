import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MEDIA } from "./media";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");

const EXPECTED_CLIPS = [
  "hero-overview",
  "flow-catalog-import",
  "flow-container-ai",
  "flow-orders-sale",
  "flow-receivables-close",
  "flow-inventory-stock",
  "flow-rates-bcv",
] as const;

const BUDGET = {
  av1Bytes: 450 * 1024,
  h264Bytes: 900 * 1024,
  posterBytes: 45 * 1024,
};

describe("media.guard (PLAN-2026-09-LANDING-REDESIGN T3.6 / F6)", () => {
  it("contains all 7 expected storyboards in MEDIA registry", () => {
    const keys = Object.keys(MEDIA);
    expect(keys).toEqual(expect.arrayContaining([...EXPECTED_CLIPS]));
    expect(keys.length).toBe(EXPECTED_CLIPS.length);
  });

  for (const clipId of EXPECTED_CLIPS) {
    describe(`clip: ${clipId}`, () => {
      const clip = MEDIA[clipId];

      it("has 16:10 dimensions at 1440x900", () => {
        expect(clip.wide.width).toBe(1440);
        expect(clip.wide.height).toBe(900);
      });

      for (const theme of ["light", "dark"] as const) {
        describe(`theme: ${theme}`, () => {
          const themed = clip.wide[theme];

          it(`poster exists in public directory and is <= 45 KB (${theme})`, () => {
            const rel = themed.poster.replace(/^\//, "");
            const diskPath = join(PUBLIC_DIR, rel);
            expect(existsSync(diskPath), `Poster missing: ${diskPath}`).toBe(
              true,
            );

            const { size } = statSync(diskPath);
            expect(
              size,
              `Poster exceeds budget: ${size} > ${BUDGET.posterBytes}`,
            ).toBeLessThanOrEqual(BUDGET.posterBytes);
          });

          it(`has both 960 and 1440 responsive renditions (${theme})`, () => {
            const widths = themed.videos.map((v) => v.width);
            expect(widths).toContain(960);
            expect(widths).toContain(1440);
          });

          it(`every video file exists and respects size budget (${theme})`, () => {
            for (const v of themed.videos) {
              // AV1 WebM check
              const av1Path = join(PUBLIC_DIR, v.av1.replace(/^\//, ""));
              expect(existsSync(av1Path), `AV1 video missing: ${av1Path}`).toBe(
                true,
              );

              const av1Stat = statSync(av1Path);
              expect(
                av1Stat.size,
                `AV1 ${v.width}px exceeds 450 KB budget: ${av1Stat.size}`,
              ).toBeLessThanOrEqual(BUDGET.av1Bytes);

              // H.264 MP4 check
              const h264Path = join(PUBLIC_DIR, v.h264.replace(/^\//, ""));
              expect(
                existsSync(h264Path),
                `H.264 video missing: ${h264Path}`,
              ).toBe(true);

              const h264Stat = statSync(h264Path);
              expect(
                h264Stat.size,
                `H.264 ${v.width}px exceeds 900 KB budget: ${h264Stat.size}`,
              ).toBeLessThanOrEqual(BUDGET.h264Bytes);
            }
          });
        });
      }
    });
  }
});
