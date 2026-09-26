#!/usr/bin/env node
/**
 * Records the landing clips (PLAN-2026-09-LANDING-REDESIGN F3): every
 * storyboard in light and dark, as 30 fps H.264 masters at 2× resolution in
 * scripts/landing-media/.cache/raw/<clip>-<theme>.mp4 (encode.mjs turns them
 * into the site renditions).
 *
 * Needs the app running against the demo workspace (default
 * http://localhost:3120, `pnpm with-env next start -p 3120` in apps/erp) and
 * the demo login from seed-demo-workspace.mjs.
 *
 * Usage (repo root):
 *   node scripts/landing-media/record.mjs                    all clips, both themes
 *   node scripts/landing-media/record.mjs --clip hero-overview --theme dark
 *   node scripts/landing-media/record.mjs --base http://localhost:3120
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { connect } from "./db.mjs";
import { CACHE, DEFAULT_BASE_URL, openSession, ROOT } from "./lib/session.mjs";
import { makeFixtures } from "./make-fixtures.mjs";
import { STORYBOARDS } from "./storyboards.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const onlyClip = flag("clip");
const onlyTheme = flag("theme");
const baseUrl = flag("base") ?? DEFAULT_BASE_URL;
const themes = onlyTheme ? [onlyTheme] : ["light", "dark"];
const clips = STORYBOARDS.filter((clip) => !onlyClip || clip.id === onlyClip);
if (clips.length === 0) throw new Error(`Unknown clip: ${onlyClip}`);

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // DATABASE_URL may already be set.
}

makeFixtures();

/** Ids of the demo products (the AI endpoint answer must point at real rows). */
async function demoContext() {
  const db = await connect();
  try {
    const { rows } = await db.query(
      `select p.sku, p.id from product p
         join workspace w on w.id = p.workspace_id
        where w.slug = 'distribuidora-aurora-demo'`,
    );
    return {
      productIdBySku: Object.fromEntries(rows.map((r) => [r.sku, r.id])),
    };
  } finally {
    await db.end();
  }
}

const raw = join(CACHE, "raw");
mkdirSync(raw, { recursive: true });
const ctx = await demoContext();
const session = await openSession({ baseUrl, theme: themes[0] });
const { stage } = session;
const report = {};

try {
  for (const clip of clips) {
    for (const theme of themes) {
      const out = join(raw, `${clip.id}-${theme}.mp4`);
      try {
        await stage.setTheme(theme);
        stage.stubs = [];
        await stage.cdp.send("Fetch.disable").catch(() => undefined);
        await clip.prepare?.(stage, ctx);
        await stage.goto(clip.start, { settle: 1200 });
        const seconds = await stage.record(out, (s) => clip.run(s, ctx));
        report[`${clip.id}-${theme}`] = {
          seconds: Math.round(seconds * 10) / 10,
        };
        console.log(`✓ ${clip.id} (${theme}) ${seconds.toFixed(1)} s`);
      } catch (error) {
        await stage
          .shot(join(raw, `${clip.id}-${theme}-error.png`))
          .catch(() => undefined);
        console.error(`✗ ${clip.id} (${theme}): ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
} finally {
  writeFileSync(join(raw, "report.json"), JSON.stringify(report, null, 2));
  await session.close();
}
