/**
 * Recording stage (PLAN-2026-09-LANDING-REDESIGN F3): drives one Chrome page
 * like a person would (eased pointer paths, typed text, smooth scrolling),
 * shows a synthetic cursor, and records the screencast to an H.264 master at
 * a constant 30 fps (2× resolution, downscaled later by encode.mjs).
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const FPS = 30;

/** Runs in every document: theme, in-page finder and the synthetic cursor. */
const pageScript = (theme) => `(() => {
  try { localStorage.setItem("cendaro-theme", ${JSON.stringify(theme)}); } catch {}

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const norm = (t) => t.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ").trim().toLowerCase();
  const TAGS = 'a,button,[role=tab],[role=option],[role=menuitem],[role=combobox],label,th,td,tr,li,h1,h2,h3,p,span,div';

  window.__find = (spec) => {
    if (typeof spec === "string") return [...document.querySelectorAll(spec)].find(visible) ?? null;
    const root = spec.within ? document.querySelector(spec.within) : document;
    if (!root) return null;
    const needle = norm(spec.text);
    const hits = [...root.querySelectorAll(spec.tag ?? TAGS)]
      .filter(visible)
      .filter((el) => norm(el.textContent ?? "").includes(needle));
    const inner = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
    return inner[spec.nth ?? 0] ?? null;
  };

  const scrollParent = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 4) return p;
    }
    return document.scrollingElement;
  };
  const tween = (box, to, ms) => new Promise((resolve) => {
    const from = box.scrollTop;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      box.scrollTop = from + (to - from) * e;
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  window.__ensureVisible = async (el) => {
    const r = el.getBoundingClientRect();
    if (r.top >= 90 && r.bottom <= innerHeight - 60) return;
    const box = scrollParent(el);
    const target = box.scrollTop + r.top - innerHeight / 2 + r.height / 2;
    await tween(box, Math.max(0, target), 600);
  };
  window.__scrollTo = async (spec, to, ms) => {
    const el = spec ? window.__find(spec) : null;
    await tween(el ?? document.querySelector("main") ?? document.scrollingElement, to, ms);
  };

  const cursor = () => {
    if (document.getElementById("__cursor")) return;
    const el = document.createElement("div");
    el.id = "__cursor";
    el.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;mix-blend-mode:difference;";
    el.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26" fill="none" style="display:block;transform-origin:2px 2px;transition:transform 90ms ease-out"><path d="M2 2 L2 20 L7 15.6 L10.4 23 L13.4 21.7 L10 14.4 L16.6 14.4 Z" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(el);
    const ring = document.createElement("div");
    ring.style.cssText = "position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border:1.5px solid #fff;border-radius:50%;opacity:0;pointer-events:none;z-index:2147483646;mix-blend-mode:difference;";
    document.documentElement.appendChild(ring);
    const saved = JSON.parse(sessionStorage.getItem("__cur") ?? "null");
    let x = saved?.x ?? 980, y = saved?.y ?? 560;
    const place = () => { el.style.transform = "translate(" + x + "px," + y + "px)"; };
    place();
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; place(); sessionStorage.setItem("__cur", JSON.stringify({ x, y })); }, true);
    addEventListener("mousedown", () => {
      el.firstChild.style.transform = "scale(0.82)";
      ring.style.transform = "translate(" + x + "px," + y + "px) scale(0.4)";
      ring.style.transition = "none"; ring.style.opacity = "0.9";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ring.style.transition = "transform 420ms ease-out, opacity 420ms ease-out";
        ring.style.transform = "translate(" + x + "px," + y + "px) scale(1.3)";
        ring.style.opacity = "0";
      }));
    }, true);
    addEventListener("mouseup", () => { el.firstChild.style.transform = "scale(1)"; }, true);
  };
  if (document.documentElement) cursor();
  addEventListener("DOMContentLoaded", cursor);
})();`;

const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const jitter = (min, max) => min + Math.random() * (max - min);

export class Stage {
  constructor(cdp, { baseUrl, width = 1440, height = 900, scale = 2 }) {
    this.cdp = cdp;
    this.baseUrl = baseUrl;
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.pointer = { x: 980, y: 560 };
    this.scriptId = null;
    this.stubs = [];
    // "Cuts": time during which no frames are written (see cut()).
    this.skipMs = 0;
    this.skipFrom = null;
  }

  /**
   * Edits out `fn`: frames are not written while it runs, so a wait for data
   * shows as an instant jump to the loaded screen instead of skeletons.
   */
  async cut(fn) {
    this.skipFrom = performance.now();
    try {
      return await fn();
    } finally {
      this.skipMs += performance.now() - this.skipFrom;
      this.skipFrom = null;
    }
  }

  /** Waits until no skeleton/pulse element has been visible for `quiet` ms. */
  async waitIdle({ quiet = 450, timeout = 25_000 } = {}) {
    const deadline = Date.now() + timeout;
    let calmSince = null;
    while (Date.now() < deadline) {
      const busy = await this.eval(
        `[...document.querySelectorAll(".animate-pulse,.animate-shimmer,[aria-busy=true]")].some((el) => el.getBoundingClientRect().width > 4)`,
      );
      if (busy) calmSince = null;
      else if ((calmSince ??= Date.now()) && Date.now() - calmSince >= quiet) {
        return;
      }
      await sleep(100);
    }
    throw new Error("Page never settled (skeletons still visible)");
  }

  /** Waits for `spec` and for the page to settle, all edited out. */
  cutUntil(spec) {
    return this.cut(async () => {
      await this.waitFor(spec, { timeout: 30_000 });
      await this.waitIdle();
    });
  }

  async prepare(theme) {
    const { cdp } = this;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: this.width,
      height: this.height,
      deviceScaleFactor: this.scale,
      mobile: false,
    });
    await this.setTheme(theme);
    cdp.on("Fetch.requestPaused", (event) => void this.#handleStub(event));
    // Wizards warn before leaving ("beforeunload"); accept so navigation never blocks.
    cdp.on("Page.javascriptDialogOpening", () => {
      void cdp
        .send("Page.handleJavaScriptDialog", { accept: true })
        .catch(() => undefined);
    });
  }

  async setTheme(theme) {
    if (this.scriptId) {
      await this.cdp.send("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: this.scriptId,
      });
    }
    const { identifier } = await this.cdp.send(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: pageScript(theme) },
    );
    this.scriptId = identifier;
    await this.cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: theme },
        { name: "prefers-reduced-motion", value: "no-preference" },
      ],
    });
  }

  async eval(expression) {
    const { result, exceptionDetails } = await this.cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
    );
    if (exceptionDetails) {
      throw new Error(
        exceptionDetails.exception?.description ?? exceptionDetails.text,
      );
    }
    return result.value;
  }

  pause(ms) {
    return sleep(ms);
  }

  /** Viewport screenshot (debugging storyboards). */
  async shot(path) {
    const { data } = await this.cdp.send("Page.captureScreenshot", {
      format: "png",
    });
    writeFileSync(path, Buffer.from(data, "base64"));
  }

  async goto(path, { settle = 900 } = {}) {
    const loaded = new Promise((resolve) => {
      const off = this.cdp.on("Page.loadEventFired", () => {
        off();
        resolve();
      });
    });
    await this.cdp.send("Page.navigate", {
      url: new URL(path, this.baseUrl).href,
    });
    await loaded;
    await this.waitFor("body");
    await sleep(settle);
  }

  async waitFor(spec, { timeout = 20_000 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (
        await this.eval(
          `!!window.__find && !!window.__find(${JSON.stringify(spec)})`,
        )
      ) {
        return;
      }
      await sleep(120);
    }
    throw new Error(`Timed out waiting for ${JSON.stringify(spec)}`);
  }

  async waitGone(spec, { timeout = 20_000 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.eval(`!!window.__find(${JSON.stringify(spec)})`))) {
        return;
      }
      await sleep(150);
    }
    throw new Error(
      `Timed out waiting for ${JSON.stringify(spec)} to disappear`,
    );
  }

  /** Point inside the target after making it visible; `at` picks where. */
  async pointOf(spec, at = { x: 0.5, y: 0.5 }) {
    await this.waitFor(spec);
    const rect = await this.eval(`(async () => {
      const el = window.__find(${JSON.stringify(spec)});
      await window.__ensureVisible(el);
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    })()`);
    return {
      x: rect.left + rect.width * at.x,
      y: rect.top + rect.height * at.y,
    };
  }

  async #mouse(type, x, y, extra = {}) {
    await this.cdp.send("Input.dispatchMouseEvent", { type, x, y, ...extra });
    this.pointer = { x, y };
  }

  /** Eased, slightly curved pointer path at ~60 Hz. */
  async move(spec, { ms, at } = {}) {
    const target = spec.x !== undefined ? spec : await this.pointOf(spec, at);
    const from = this.pointer;
    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    const duration = ms ?? Math.min(1100, Math.max(380, dist * 1.1));
    const bend = Math.min(60, dist * 0.12) * (Math.random() < 0.5 ? -1 : 1);
    const nx = -(target.y - from.y) / (dist || 1);
    const ny = (target.x - from.x) / (dist || 1);
    const start = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - start) / duration);
      const e = easeInOut(t);
      const curve = Math.sin(Math.PI * e) * bend;
      await this.#mouse(
        "mouseMoved",
        from.x + (target.x - from.x) * e + nx * curve,
        from.y + (target.y - from.y) * e + ny * curve,
      );
      if (t >= 1) break;
      await sleep(14);
    }
  }

  async hover(spec, opts) {
    await this.move(spec, opts);
    await sleep(jitter(220, 380));
  }

  async click(spec, opts = {}) {
    await this.move(spec, opts);
    await sleep(jitter(120, 220));
    const { x, y } = this.pointer;
    await this.#mouse("mousePressed", x, y, {
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await sleep(jitter(70, 110));
    await this.#mouse("mouseReleased", x, y, {
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await sleep(opts.after ?? 350);
  }

  /** Types like a person: per-key events with uneven timing. */
  async type(text, { cps = 13 } = {}) {
    for (const ch of text) {
      await this.cdp.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: ch,
        text: ch,
      });
      await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
      await sleep((1000 / cps) * jitter(0.6, 1.5));
    }
  }

  async key(key, { ctrl = false } = {}) {
    const codes = { Escape: 27, Enter: 13, Tab: 9 };
    const base = {
      key,
      code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
      windowsVirtualKeyCode:
        key.length === 1 ? key.toUpperCase().charCodeAt(0) : (codes[key] ?? 0),
      modifiers: ctrl ? 2 : 0,
    };
    // Enter needs `text` on a keyDown so the browser runs implicit form submit.
    await this.cdp.send("Input.dispatchKeyEvent", {
      type: key === "Enter" ? "keyDown" : "rawKeyDown",
      ...(key === "Enter" ? { text: "\r" } : {}),
      ...base,
    });
    await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await sleep(300);
  }

  async scroll(to, { spec, ms = 900 } = {}) {
    await this.eval(
      `window.__scrollTo(${spec ? JSON.stringify(spec) : "null"}, ${to}, ${ms})`,
    );
  }

  /** Selects a file in a hidden input (DataTransfer; a CDP file chooser hangs the page). */
  async attach(inputSelector, filePath, mime) {
    const b64 = readFileSync(filePath).toString("base64");
    const name = filePath.split(/[\\/]/).pop();
    await this.eval(`(() => {
      const bytes = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0));
      const file = new File([bytes], ${JSON.stringify(name)}, { type: ${JSON.stringify(mime)} });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector(${JSON.stringify(inputSelector)});
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
  }

  /** Answers a request from the recorder instead of the network, after a delay. */
  async stub(urlPattern, { status = 200, body, delayMs = 0 }) {
    this.stubs.push({ urlPattern, status, body, delayMs });
    await this.cdp.send("Fetch.enable", {
      patterns: this.stubs.map((s) => ({ urlPattern: s.urlPattern })),
    });
  }

  async #handleStub(event) {
    const { request, requestId } = event;
    const match = this.stubs.find((s) =>
      new RegExp(s.urlPattern.replace(/\*/g, ".*")).test(request.url),
    );
    if (!match) {
      await this.cdp.send("Fetch.continueRequest", { requestId });
      return;
    }
    await sleep(match.delayMs);
    await this.cdp.send("Fetch.fulfillRequest", {
      requestId,
      responseCode: match.status,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(match.body)).toString("base64"),
    });
  }

  async login(username, password) {
    await this.goto("/login", { settle: 500 });
    await this.eval(`document.querySelector("input[type=text]").focus()`);
    await this.cdp.send("Input.insertText", { text: username });
    await this.eval(`document.querySelector("input[type=password]").focus()`);
    await this.cdp.send("Input.insertText", { text: password });
    await this.key("Enter");
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if ((await this.eval("location.pathname")) === "/dashboard") return;
      await sleep(300);
    }
    throw new Error("Login did not reach /dashboard");
  }

  /**
   * Records `run(stage)` to `outFile` (H.264 master, constant 30 fps).
   * `preroll`/`postroll` hold the first and last state so the loop is clean.
   */
  async record(outFile, run, { preroll = 450, postroll = 700 } = {}) {
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-framerate",
        String(FPS),
        "-vcodec",
        "mjpeg",
        "-i",
        "pipe:0",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "12",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outFile,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    const exited = new Promise((resolve, reject) => {
      ffmpeg.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
      );
    });

    let latest = null;
    const off = this.cdp.on("Page.screencastFrame", (frame) => {
      latest = Buffer.from(frame.data, "base64");
      this.cdp
        .send("Page.screencastFrameAck", { sessionId: frame.sessionId })
        .catch(() => undefined);
    });
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 100,
      maxWidth: this.width * this.scale,
      maxHeight: this.height * this.scale,
      everyNthFrame: 1,
    });
    while (!latest) await sleep(20);

    const t0 = performance.now();
    this.skipMs = 0;
    this.skipFrom = null;
    const home = { ...this.pointer };
    let written = 0;
    let ticking = false;
    const tick = async () => {
      if (ticking) return;
      ticking = true;
      // While a cut is open the clock stops at the moment it started.
      const now = this.skipFrom ?? performance.now();
      const due = Math.floor(((now - t0 - this.skipMs) / 1000) * FPS);
      while (written < due) {
        if (!ffmpeg.stdin.write(latest)) {
          await new Promise((r) => ffmpeg.stdin.once("drain", r));
        }
        written++;
      }
      ticking = false;
    };
    const timer = setInterval(() => void tick(), 8);

    try {
      await sleep(preroll);
      await run(this);
      // Cursor back where the clip began, so the loop restarts seamlessly.
      await this.move(home, { ms: 650 });
      await sleep(postroll);
      await tick();
    } finally {
      // Always release the screencast and ffmpeg, even when a storyboard
      // fails: leaked encoders would corrupt the next recording.
      clearInterval(timer);
      await this.cdp.send("Page.stopScreencast").catch(() => undefined);
      off();
      ffmpeg.stdin.end();
      await exited.catch(() => undefined);
    }
    return written / FPS;
  }
}
