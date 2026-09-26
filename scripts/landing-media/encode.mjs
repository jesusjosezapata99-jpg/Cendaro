#!/usr/bin/env node
/**
 * Encodes the recorded masters into the site renditions
 * (PLAN-2026-09-LANDING-REDESIGN F3, T3.4) in scripts/landing-media/.cache/encoded/:
 *
 *   <clip>-<theme>-<width>.webm   AV1   (primary source)
 *   <clip>-<theme>-<width>.mp4    H.264 (fallback, faststart)
 *   <clip>-<theme>-poster.avif    frame at `posterAt`, 1440 px wide
 *   meta.json                     dimensions and byte sizes for the manifest
 *
 * Budgets (plan §5): AV1 ≤ 450 KB and H.264 ≤ 900 KB at 1440 px, poster
 * ≤ 45 KB. When a file is over budget the CRF is raised until it fits.
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
const WIDTHS = [960, 1440];
const THEMES = ["light", "dark"];
const KB = 1024;
const BUDGET = { av1: 450 * KB, h264: 900 * KB, poster: 45 * KB };
const MAX_CRF_STEPS = 8;

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

/** Encodes until the file fits its budget, raising the CRF by 2 each attempt. */
function encodeWithinBudget({ master, out, width, codec, startCrf }) {
  const scale = `scale=${width}:-2:flags=lanczos,unsharp=3:3:0.3:3:3:0.0`;
  let crf = startCrf;
  for (let step = 0; step <= MAX_CRF_STEPS; step++, crf += 2) {
    const codecArgs =
      codec === "av1"
        ? [
            "-c:v",
            "libsvtav1",
            "-crf",
            String(crf),
            "-preset",
            "6",
            "-g",
            "240",
          ]
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
    if (bytes <= BUDGET[codec] || step === MAX_CRF_STEPS) return { bytes, crf };
  }
  throw new Error("unreachable");
}

async function encodePoster({ master, out, at }) {
  const png = join(OUT, "_poster.png");
  ffmpeg(["-ss", at.toFixed(2), "-i", master, "-frames:v", "1", png]);
  let quality = 55;
  let bytes = Infinity;
  while (bytes > BUDGET.poster && quality >= 25) {
    await sharp(png).resize(1440).avif({ quality, effort: 6 }).toFile(out);
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
      const av1 = encodeWithinBudget({
        master,
        out: join(OUT, `${key}-${w}.webm`),
        width: w,
        codec: "av1",
        startCrf: w === 960 ? 28 : 24,
      });
      const h264 = encodeWithinBudget({
        master,
        out: join(OUT, `${key}-${w}.mp4`),
        width: w,
        codec: "h264",
        startCrf: w === 960 ? 22 : 20,
      });
      entry.renditions.push({
        width: w,
        av1Bytes: av1.bytes,
        h264Bytes: h264.bytes,
        av1Crf: av1.crf,
        h264Crf: h264.crf,
      });
    }
    meta[key] = entry;
    const r = entry.renditions.at(-1);
    console.log(
      `✓ ${key}  ${duration.toFixed(1)} s  poster ${(entry.posterBytes / KB).toFixed(0)} KB  1440: av1 ${(r.av1Bytes / KB).toFixed(0)} KB (crf ${r.av1Crf}) h264 ${(r.h264Bytes / KB).toFixed(0)} KB (crf ${r.h264Crf})`,
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
