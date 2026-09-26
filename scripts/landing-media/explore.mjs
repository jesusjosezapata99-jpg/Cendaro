#!/usr/bin/env node
/**
 * Runs a scratch script against a logged-in demo session to design
 * storyboards: `node scripts/landing-media/explore.mjs <script.mjs> [light|dark]`.
 * The script default-exports `async (stage) => {}`; use `stage.shot(path)`.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { openSession } from "./lib/session.mjs";

const [, , script, theme = "light"] = process.argv;
if (!script) {
  console.error("usage: explore.mjs <script.mjs> [light|dark]");
  process.exit(1);
}

const session = await openSession({ theme });
try {
  const { default: run } = await import(pathToFileURL(resolve(script)).href);
  await run(session.stage);
} finally {
  await session.close();
}
