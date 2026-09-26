/**
 * Minimal Chrome DevTools Protocol client for the landing-media recorder
 * (PLAN-2026-09-LANDING-REDESIGN F3): launches a headless Chrome with an
 * isolated profile and talks to one page over Node's built-in WebSocket.
 * No dependencies. `agent-browser record` was not used because it emits a
 * fixed 10 fps video, too choppy for cursor and scroll motion.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error("Chrome not found; set CHROME_PATH");
  return found;
}

async function waitForDebugger(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await sleep(150);
  }
  throw new Error(`Chrome did not open the debugging port ${port}`);
}

/** Starts headless Chrome with a throw-away profile; `close()` removes it. */
export async function launchChrome({ port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "cendaro-rec-"));
  const proc = spawn(
    findChrome(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--window-size=1440,900",
      // Real 2× surface: screencast frames follow the physical size, not the
      // CDP metrics override.
      "--force-device-scale-factor=2",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-features=Translate,MediaRouter",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  await waitForDebugger(port);
  return {
    port,
    async close() {
      proc.kill();
      await sleep(600);
      rmSync(profile, { recursive: true, force: true, maxRetries: 8 });
    },
  };
}

export class Cdp {
  static async connect(port) {
    const targets = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("No page target found");
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("CDP socket failed"));
    });
    return new Cdp(socket);
  }

  #socket;
  #nextId = 0;
  #pending = new Map();
  #handlers = new Map();

  constructor(socket) {
    this.#socket = socket;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const call = this.#pending.get(message.id);
        if (!call) return;
        this.#pending.delete(message.id);
        if (message.error) {
          call.reject(new Error(`${call.method}: ${message.error.message}`));
        } else {
          call.resolve(message.result);
        }
        return;
      }
      for (const handler of this.#handlers.get(message.method) ?? []) {
        handler(message.params);
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.#nextId;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Subscribes to an event; returns the unsubscribe function. */
  on(method, handler) {
    const list = this.#handlers.get(method) ?? [];
    list.push(handler);
    this.#handlers.set(method, list);
    return () =>
      this.#handlers.set(
        method,
        (this.#handlers.get(method) ?? []).filter((h) => h !== handler),
      );
  }

  close() {
    this.#socket.close();
  }
}
