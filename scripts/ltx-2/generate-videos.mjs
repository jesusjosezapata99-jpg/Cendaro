#!/usr/bin/env node

/**
 * ─────────────────────────────────────────────────────────
 * LTX-2 Video Pre-Rendering Pipeline — Cendaro
 * ─────────────────────────────────────────────────────────
 *
 * Generates cinematic AI videos via the Lightricks LTX Cloud API
 * and saves them as static MP4 assets in apps/erp/public/videos/.
 *
 * Usage:
 *   pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs
 *   pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs --dry-run
 *   pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs --only hero-cinematic
 *   pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs --model ltx-2-3-pro
 *
 * Environment:
 *   LTX_API_KEY — Required. Obtain from https://console.ltx.video/
 *
 * Security:
 *   - API key is NEVER logged, written to disk, or exposed.
 *   - Key is read exclusively from environment variables.
 */

import { mkdir, stat } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

/* ── Constants ─────────────────────────────────────────── */

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const OUTPUT_DIR = resolve(PROJECT_ROOT, "apps/erp/public/videos");
const PROMPTS_PATH = resolve(__dirname, "prompts.json");
const API_BASE = "https://api.ltx.video/v1";
const COST_PER_SECOND = 0.04; // Fast 1080p

/* ── CLI argument parsing ──────────────────────────────── */

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const DRY_RUN = args.includes("--dry-run");
const ONLY = getFlag("only");
const MODEL_OVERRIDE = getFlag("model");

/* ── Logging helpers ───────────────────────────────────── */

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function log(icon, msg) {
  console.log(`${c.dim}[ltx]${c.reset} ${icon} ${msg}`);
}

function logError(msg) {
  console.error(`${c.dim}[ltx]${c.reset} ${c.red}✗${c.reset} ${msg}`);
}

/* ── Main pipeline ─────────────────────────────────────── */

async function main() {
  console.log();
  console.log(
    `${c.bold}${c.magenta}  ╔══════════════════════════════════════════╗${c.reset}`
  );
  console.log(
    `${c.bold}${c.magenta}  ║   LTX-2 Video Pre-Rendering Pipeline    ║${c.reset}`
  );
  console.log(
    `${c.bold}${c.magenta}  ║   Cendaro — Landing Page Assets          ║${c.reset}`
  );
  console.log(
    `${c.bold}${c.magenta}  ╚══════════════════════════════════════════╝${c.reset}`
  );
  console.log();

  /* 1. Validate API key */
  const apiKey = process.env.LTX_API_KEY;

  if (!apiKey) {
    logError("LTX_API_KEY not found in environment.");
    logError(
      "Run: pnpm exec dotenv -e apps/erp/.env.local -- node scripts/ltx-2/generate-videos.mjs"
    );
    process.exit(1);
  }

  if (!apiKey.startsWith("ltxv_")) {
    logError("LTX_API_KEY has invalid format (must start with 'ltxv_').");
    process.exit(1);
  }

  log("🔑", "API key validated and loaded into memory");

  /* 2. Load prompt configuration */
  const { default: prompts } = await import(
    `file://${PROMPTS_PATH.replace(/\\/g, "/")}`,
    { with: { type: "json" } }
  );

  if (!Array.isArray(prompts) || prompts.length === 0) {
    logError("No prompts found in prompts.json");
    process.exit(1);
  }

  /* 3. Filter by --only flag */
  let videosToGenerate = prompts;
  if (ONLY) {
    videosToGenerate = prompts.filter((p) => p.name === ONLY);
    if (videosToGenerate.length === 0) {
      logError(`No prompt found with name "${ONLY}".`);
      logError(
        `Available: ${prompts.map((p) => p.name).join(", ")}`
      );
      process.exit(1);
    }
  }

  /* 4. Calculate budget */
  const totalSeconds = videosToGenerate.reduce(
    (sum, v) => sum + v.duration,
    0
  );
  const totalCost = totalSeconds * COST_PER_SECOND;

  console.log(`${c.dim}  ─────────────────────────────────────────${c.reset}`);
  log(
    "📋",
    `${c.bold}${videosToGenerate.length} video(s)${c.reset} · ${totalSeconds}s total · ${c.green}$${totalCost.toFixed(2)}${c.reset} estimated`
  );
  console.log(`${c.dim}  ─────────────────────────────────────────${c.reset}`);

  /* 5. Show plan */
  for (const video of videosToGenerate) {
    const model = MODEL_OVERRIDE || video.model;
    const cost = video.duration * COST_PER_SECOND;
    log(
      "🎬",
      `${c.cyan}${video.name}${c.reset} · ${video.duration}s · ${model} · $${cost.toFixed(2)}`
    );
  }
  console.log();

  /* 6. Dry-run exit */
  if (DRY_RUN) {
    log("🏁", `${c.yellow}Dry run complete.${c.reset} No API calls made.`);
    console.log();
    return;
  }

  /* 7. Ensure output directory */
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    log("📁", `Created ${OUTPUT_DIR}`);
  }

  /* 8. Generate videos sequentially (respect budget) */
  let totalSpent = 0;

  for (let i = 0; i < videosToGenerate.length; i++) {
    const video = videosToGenerate[i];
    const model = MODEL_OVERRIDE || video.model;
    /* Sanitize filename — strip any non-alphanumeric/dash/underscore chars
       to prevent path traversal (CodeQL: js/path-injection) */
    const safeName = video.name.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const outputPath = resolve(OUTPUT_DIR, `${safeName}.mp4`);

    /* Defense-in-depth: verify resolved path is inside OUTPUT_DIR */
    if (!outputPath.startsWith(OUTPUT_DIR)) {
      logError(`Path traversal detected for "${video.name}". Skipping.`);
      continue;
    }

    log(
      "⏳",
      `${c.bold}[${i + 1}/${videosToGenerate.length}]${c.reset} Generating ${c.cyan}${video.name}${c.reset} (${video.duration}s, ${model})...`
    );

    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE}/text-to-video`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: video.prompt,
          model: model,
          duration: video.duration,
          resolution: video.resolution,
          generate_audio: video.generate_audio,
        }),
      });

      /* Handle API errors */
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        logError(
          `API returned ${response.status} for ${video.name}: ${errorText}`
        );

        if (response.status === 402) {
          logError("Insufficient credits. Stopping.");
          break;
        }

        log("⚠️", "Skipping this video and continuing...");
        continue;
      }

      /* Validate content type */
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("video/mp4")) {
        logError(
          `Unexpected content-type: ${contentType}. Expected video/mp4.`
        );
        const body = await response.text().catch(() => "");
        logError(`Response body: ${body.slice(0, 200)}`);
        continue;
      }

      /* Enforce file size cap (500 MB) to prevent resource exhaustion
         (CodeQL: js/network-data-written-to-file) */
      const MAX_FILE_BYTES = 500 * 1024 * 1024;
      const contentLength = Number(
        response.headers.get("content-length") || "0"
      );
      if (contentLength > MAX_FILE_BYTES) {
        logError(
          `Response too large (${(contentLength / (1024 * 1024)).toFixed(0)} MB exceeds 500 MB cap). Skipping.`
        );
        continue;
      }

      /* Stream response to disk via Node.js pipeline (memory-efficient).
         pipeline() handles backpressure and automatic cleanup on errors. */
      const fileStream = createWriteStream(outputPath);
      await pipeline(Readable.fromWeb(response.body), fileStream);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fileStats = await stat(outputPath);
      const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
      const cost = video.duration * COST_PER_SECOND;
      totalSpent += cost;

      const requestId =
        response.headers.get("x-request-id") || "n/a";

      log(
        "✅",
        `${c.green}${video.name}.mp4${c.reset} · ${sizeMB} MB · ${elapsed}s · $${cost.toFixed(2)} · ${c.dim}req:${requestId}${c.reset}`
      );
    } catch (err) {
      logError(`Network error generating ${video.name}: ${err.message}`);
      log("⚠️", "Skipping this video and continuing...");
      continue;
    }
  }

  /* 9. Summary */
  console.log();
  console.log(`${c.dim}  ─────────────────────────────────────────${c.reset}`);
  log(
    "🏁",
    `${c.bold}${c.green}Complete!${c.reset} Spent: ${c.green}$${totalSpent.toFixed(2)}${c.reset} · Output: ${c.dim}${OUTPUT_DIR}${c.reset}`
  );
  console.log();
}

main().catch((err) => {
  logError(`Fatal: ${err.message}`);
  process.exit(1);
});
