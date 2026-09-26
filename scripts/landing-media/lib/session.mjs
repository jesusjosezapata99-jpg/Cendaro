/**
 * Opens a logged-in recording session (PLAN-2026-09-LANDING-REDESIGN F3):
 * headless Chrome + the demo owner from `.env.landing-demo` (written by
 * seed-demo-workspace.mjs, git-ignored). Shared by record.mjs and explore.mjs.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Cdp, launchChrome } from "./cdp.mjs";
import { Stage } from "./stage.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
export const CACHE = join(ROOT, "scripts/landing-media/.cache");

export const DEFAULT_BASE_URL = "http://localhost:3000";

export async function openSession({
  baseUrl = DEFAULT_BASE_URL,
  theme = "light",
} = {}) {
  const credentials = join(ROOT, ".env.landing-demo");
  if (!existsSync(credentials)) {
    throw new Error(
      ".env.landing-demo not found: run scripts/landing-media/seed-demo-workspace.mjs",
    );
  }
  process.loadEnvFile(credentials);
  const { LANDING_DEMO_USERNAME: user, LANDING_DEMO_PASSWORD: password } =
    process.env;
  if (!user || !password) throw new Error("Demo credentials missing");

  const res = await fetch(new URL("/login", baseUrl)).catch(() => null);
  if (!res?.ok) throw new Error(`App not reachable at ${baseUrl}`);

  const chrome = await launchChrome();
  const cdp = await Cdp.connect(chrome.port);
  const stage = new Stage(cdp, { baseUrl });
  await stage.prepare(theme);
  await stage.login(user, password);
  return {
    stage,
    async close() {
      cdp.close();
      await chrome.close();
    },
  };
}
