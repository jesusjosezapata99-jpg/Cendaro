#!/usr/bin/env node
/**
 * Encodes the recorded masters into the site renditions
 * (PLAN-2026-09-LANDING-REDESIGN F3, T3.4) in scripts/landing-media/.cache/encoded/:
 *
 *   <clip>-<theme>-<width>.webm   AV1   (primary source)
 *   <clip>-<theme>-<width>.mp4    H.264 (fallback, faststart)
 *   <clip>-<theme>-poster.avif    frame at `posterAt`, 2160 px wide
 *   meta.json                     dimensions and byte sizes for the manifest
 *
 * Quality over byte-budget (revised after the first pass shipped visibly
 * blurry, per user report on 2026-09-27): the masters are DPR-2 recordings
 * (2880×1800), so a 1440 px cap meant every HiDPI viewer — the majority of
 * laptops and external monitors — was upscaling a sub-native asset. Widths
 * now go up to 2160 px, and CRF is fixed at a quality that keeps flat UI text
 * crisp rather than climbing until a small byte cap is hit. Only ONE
 * rendition is ever attached per visible clip (`<LandingVideo>` picks the
 * smallest one that covers the rendered box at the viewer's DPR); the four
 * clips `home/how-it-works.tsx` stacks still each get a `<video
 * preload="metadata">` once near the viewport, so an inactive step costs a
 * small metadata request, not its full byte size — only the active step
 * streams in full.
 *
 * The AV1 codecs string in the manifest is per-rendition (`av1Type`), read
 * from the encoded file's actual bitstream level via ffprobe: 2160 px
 * exceeds AV1 level 4.0's frame-size limit, so a fixed "level 4.0" string
 * for every width (as shipped originally) would make a level-4-only
 * hardware decoder accept a source it can't actually decode, with no
 * fallback once past the `<source>` selection step.
 *
 * Usage (repo root): node scripts/landing-media/encode.mjs [--clip id]
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { CACHE, ROOT } from "./lib/session.mjs";
import { STORYBOARDS } from "./storyboards.mjs";

const sharp = createRequire(join(ROOT, "apps/erp/package.json"))("sharp");

const RAW = join(CACHE, "raw");
const OUT = join(CACHE, "encoded");
const WIDTHS = [960, 1440, 2160];
const THEMES = ["light", "dark"];
const KB = 1024;
const MB = 1024 * KB;
/**
 * Fixed quality per width — screen content compresses well, so low CRF stays
 * affordable. AV1 sits a few CRF steps above its H.264 counterpart because,
 * for this flat UI content, SVT-AV1 at the same CRF number lands noticeably
 * larger than x264 at visually matching quality; these values were picked so
 * AV1 (the primary source) is not the heavier of the two.
 */
const AV1_CRF = { 960: 30, 1440: 28, 2160: 26 };
const H264_CRF = { 960: 20, 1440: 19, 2160: 18 };
/**
 * Not a hard cap — media.guard.test.ts enforces the real ceiling; this only
 * logs an early signal. Anchored at 1440px with ~1.6x headroom over the
 * heaviest clip observed at each width (a scrolling data table).
 */
const SOFT_LIMIT = { av1: 0.9 * MB, h264: 1.42 * MB };
/** Posters are HiDPI-sized too — a reduced-motion or data-saver viewer only ever sees this. */
const POSTER_WIDTH = 2160;
const POSTER_BUDGET = 90 * KB;

const only = process.argv.includes("--clip")
  ? process.argv[process.argv.indexOf("--clip") + 1]
  : undefined;

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function probe(file) {
  const out = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      file,
    ],
    { encoding: "utf8" },
  );
  const json = JSON.parse(out);
  return {
    width: json.streams[0].width,
    height: json.streams[0].height,
    duration: Number(json.format.duration),
  };
}

/** AV1 bitstream level (ffprobe's raw seq_level_idx, e.g. 8 = level 4.0, 12 = level 5.0). */
function probeAv1Level(file) {
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

/** Encodes at the fixed quality for `width`; warns (does not degrade) if unusually heavy. */
function encodeAt({ master, out, width, codec }) {
  const scale = `scale=${width}:-2:flags=lanczos`;
  const crf = (codec === "av1" ? AV1_CRF : H264_CRF)[width];
  if (crf === undefined) {
    throw new Error(`No ${codec} CRF configured for width ${width}`);
  }
  const codecArgs =
    codec === "av1"
      ? ["-c:v", "libsvtav1", "-crf", String(crf), "-preset", "6", "-g", "240"]
      : [
          "-c:v",
          "libx264",
          "-crf",
          String(crf),
          "-preset",
          "slow",
          "-profile:v",
          "high",
          "-movflags",
          "+faststart",
        ];
  ffmpeg([
    "-i",
    master,
    "-vf",
    scale,
    "-r",
    "30",
    ...codecArgs,
    "-pix_fmt",
    "yuv420p",
    "-an",
    out,
  ]);
  const bytes = statSync(out).size;
  if (bytes > SOFT_LIMIT[codec] * (width / 1440)) {
    console.warn(
      `  ⚠ ${out} is ${(bytes / KB).toFixed(0)} KB — unusually heavy motion`,
    );
  }
  return {
    bytes,
    crf,
    av1Level: codec === "av1" ? probeAv1Level(out) : undefined,
  };
}

async function encodePoster({ master, out, at }) {
  const png = join(OUT, "_poster.png");
  ffmpeg(["-ss", at.toFixed(2), "-i", master, "-frames:v", "1", png]);
  let quality = 55;
  let bytes = Infinity;
  while (bytes > POSTER_BUDGET && quality >= 25) {
    await sharp(png)
      .resize(POSTER_WIDTH)
      .avif({ quality, effort: 6 })
      .toFile(out);
    bytes = statSync(out).size;
    quality -= 5;
  }
  rmSync(png, { force: true });
  return bytes;
}

mkdirSync(OUT, { recursive: true });
const meta = {};
const clips = STORYBOARDS.filter((clip) => !only || clip.id === only);

for (const clip of clips) {
  for (const theme of THEMES) {
    const master = join(RAW, `${clip.id}-${theme}.mp4`);
    const { width, height, duration } = probe(master);
    const key = `${clip.id}-${theme}`;
    const entry = {
      clip: clip.id,
      theme,
      width: 1440,
      height: Math.round((1440 * height) / width),
      duration,
      renditions: [],
    };

    entry.posterBytes = await encodePoster({
      master,
      out: join(OUT, `${key}-poster.avif`),
      at: duration * clip.posterAt,
    });
    for (const w of WIDTHS) {
      const av1 = encodeAt({
        master,
        out: join(OUT, `${key}-${w}.webm`),
        width: w,
        codec: "av1",
      });
      const h264 = encodeAt({
        master,
        out: join(OUT, `${key}-${w}.mp4`),
        width: w,
        codec: "h264",
      });
      entry.renditions.push({
        width: w,
        av1Bytes: av1.bytes,
        h264Bytes: h264.bytes,
        av1Crf: av1.crf,
        h264Crf: h264.crf,
        av1Level: av1.av1Level,
      });
    }
    meta[key] = entry;
    const r = entry.renditions.at(-1);
    console.log(
      `✓ ${key}  ${duration.toFixed(1)} s  poster ${(entry.posterBytes / KB).toFixed(0)} KB  ${r.width}: av1 ${(r.av1Bytes / KB).toFixed(0)} KB (crf ${r.av1Crf}) h264 ${(r.h264Bytes / KB).toFixed(0)} KB (crf ${r.h264Crf})`,
    );
  }
}

// Keep entries of clips that were not re-encoded this time.
let previous = {};
try {
  previous = JSON.parse(readFileSync(join(OUT, "meta.json"), "utf8"));
} catch {
  // First run.
}
writeFileSync(
  join(OUT, "meta.json"),
  JSON.stringify({ ...previous, ...meta }, null, 2),
);
