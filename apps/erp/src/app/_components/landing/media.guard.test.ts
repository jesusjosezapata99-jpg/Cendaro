import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { MEDIA } from "./media";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");

/**
 * ffprobe backs the two checks below that read a video's real bitstream
 * (not just its byte size): the claimed width and the AV1 level embedded in
 * `av1Type`. Both matter because encode.mjs derives `av1Type` from ffprobe
 * output too — this is the test that would have caught the wrong fixed
 * "level 4.0" string once 2160px renditions (level 5.0) shipped.
 */
let ffprobeAvailable = true;
beforeAll(() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
  } catch {
    ffprobeAvailable = false;
    console.warn(
      "media.guard: ffprobe not found — skipping bitstream width/level checks",
    );
  }
});

function probeWidth(file: string): number {
  const out = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf8" },
  );
  return Number(out.trim());
}

function probeAv1Level(file: string): number {
  const out = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=level",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf8" },
  );
  return Number(out.trim());
}

const EXPECTED_CLIPS = [
  "hero-overview",
  "flow-catalog-import",
  "flow-container-ai",
  "flow-orders-sale",
  "flow-receivables-close",
  "flow-inventory-stock",
  "flow-rates-bcv",
] as const;

/** Posters are 2160px-wide now too (matches encode.mjs's POSTER_WIDTH/POSTER_BUDGET). */
const POSTER_BUDGET = 90 * 1024;

/**
 * Ceilings scale with width — encode.mjs fixes CRF for sharpness rather than
 * shrinking to a flat byte cap, so a wider (HiDPI) rendition of a busy clip
 * legitimately costs more. Mirrors encode.mjs's SOFT_LIMIT × (width / 1440):
 * ~1.6x headroom over the heaviest clip observed at each width (a scrolling
 * data table), tight enough to fail if `unsharp` or a byte-budget CRF climb
 * is reintroduced.
 */
function budgetFor(width: number): { av1: number; h264: number } {
  const scale = width / 1440;
  return { av1: 0.9 * 1024 * 1024 * scale, h264: 1.42 * 1024 * 1024 * scale };
}

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

          it(`poster exists in public directory and is <= 90 KB (${theme})`, () => {
            const rel = themed.poster.replace(/^\//, "");
            const diskPath = join(PUBLIC_DIR, rel);
            expect(existsSync(diskPath), `Poster missing: ${diskPath}`).toBe(
              true,
            );

            const { size } = statSync(diskPath);
            expect(
              size,
              `Poster exceeds budget: ${size} > ${POSTER_BUDGET}`,
            ).toBeLessThanOrEqual(POSTER_BUDGET);
          });

          it(`has 960, 1440 and 2160 responsive renditions (${theme})`, () => {
            const widths = themed.videos.map((v) => v.width);
            expect(widths).toContain(960);
            expect(widths).toContain(1440);
            expect(widths).toContain(2160);
          });

          it(`every video file exists, respects its width's size budget, and matches its claimed width/level (${theme})`, () => {
            for (const v of themed.videos) {
              const budget = budgetFor(v.width);

              // AV1 WebM check
              const av1Path = join(PUBLIC_DIR, v.av1.replace(/^\//, ""));
              expect(existsSync(av1Path), `AV1 video missing: ${av1Path}`).toBe(
                true,
              );

              const av1Stat = statSync(av1Path);
              expect(
                av1Stat.size,
                `AV1 ${v.width}px exceeds budget: ${av1Stat.size} > ${budget.av1}`,
              ).toBeLessThanOrEqual(budget.av1);

              // H.264 MP4 check
              const h264Path = join(PUBLIC_DIR, v.h264.replace(/^\//, ""));
              expect(
                existsSync(h264Path),
                `H.264 video missing: ${h264Path}`,
              ).toBe(true);

              const h264Stat = statSync(h264Path);
              expect(
                h264Stat.size,
                `H.264 ${v.width}px exceeds budget: ${h264Stat.size} > ${budget.h264}`,
              ).toBeLessThanOrEqual(budget.h264);

              if (!ffprobeAvailable) continue;

              // The rendition's real pixel width must match what the manifest claims.
              expect(
                probeWidth(av1Path),
                `AV1 ${av1Path} is not actually ${v.width}px wide`,
              ).toBe(v.width);
              expect(
                probeWidth(h264Path),
                `H.264 ${h264Path} is not actually ${v.width}px wide`,
              ).toBe(v.width);

              // The declared av01.0.LLM.08 level must match the file's real bitstream level —
              // this is the exact bug that shipped a "level 4.0" string on a level-5.0 2160px file.
              const declaredLevel = /av01\.\d\.(\d\d)M/.exec(v.av1Type)?.[1];
              expect(
                declaredLevel,
                `av1Type has no parseable level: ${v.av1Type}`,
              ).toBeDefined();
              expect(
                Number(declaredLevel),
                `av1Type claims level ${declaredLevel} but ${av1Path} is level ${probeAv1Level(av1Path)}`,
              ).toBe(probeAv1Level(av1Path));
            }
          });

          it(`byte size grows with width, per codec (${theme})`, () => {
            const sorted = [...themed.videos].sort((a, b) => a.width - b.width);
            for (let i = 1; i < sorted.length; i++) {
              const prev = sorted[i - 1];
              const cur = sorted[i];
              if (!prev || !cur) continue;
              const prevAv1 = statSync(
                join(PUBLIC_DIR, prev.av1.replace(/^\//, "")),
              ).size;
              const curAv1 = statSync(
                join(PUBLIC_DIR, cur.av1.replace(/^\//, "")),
              ).size;
              const prevH264 = statSync(
                join(PUBLIC_DIR, prev.h264.replace(/^\//, "")),
              ).size;
              const curH264 = statSync(
                join(PUBLIC_DIR, cur.h264.replace(/^\//, "")),
              ).size;

              expect(
                curAv1,
                `AV1 ${cur.width}px (${curAv1}B) is not larger than ${prev.width}px (${prevAv1}B) — a byte-budget-driven CRF climb would flatten this`,
              ).toBeGreaterThanOrEqual(prevAv1);
              expect(
                curH264,
                `H.264 ${cur.width}px (${curH264}B) is not larger than ${prev.width}px (${prevH264}B)`,
              ).toBeGreaterThanOrEqual(prevH264);
            }
          });
        });
      }
    });
  }
});
