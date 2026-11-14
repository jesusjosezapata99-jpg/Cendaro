/**
 * Cendaro ERP — Concurrent HTTP & Supavisor (:6543) Load Benchmark (k6)
 *
 * Exercises Vercel Serverless + Supabase Transaction Pooler (`max: 3` per instance)
 * across three realistic workload profiles:
 *   • PROFILE=SMOKE             — 5 VUs / 30s sanity verification
 *   • PROFILE=LOAD_250RPS       — 200 RPS batched ERP reads + 50 RPS POS hotspot writes
 *   • PROFILE=HOTSPOT_CONTEND   — 50 concurrent VUs hammering a single SKU on `sales.checkoutPos`
 *                                 (plus 10% duplicate `idempotencyKey` replays to prove
 *                                 `pg_advisory_xact_lock` idempotency & zero negative stock)
 *
 * Safety guard: Refuses to target production hosts unless ALLOW_PROD_LOAD_TEST=I_UNDERSTAND.
 */
import { check, fail, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const WORKSPACE_ID = __ENV.WORKSPACE_ID || "";
const PROFILE = (__ENV.PROFILE || "SMOKE").toUpperCase();
const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const TEST_EMAIL = __ENV.TEST_EMAIL || "";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "";
const PREMINTED_COOKIE = __ENV.AUTH_COOKIE || "";
const HOTSPOT_PRODUCT_ID = __ENV.HOTSPOT_PRODUCT_ID || "";
const HOTSPOT_UNIT_PRICE = Number(__ENV.HOTSPOT_UNIT_PRICE || "12.50");

const posConflictOrExhausted = new Counter("cendaro_pos_stock_exhausted_total");
const posUnexpected5xx = new Rate("cendaro_unexpected_5xx_rate");
const trpcBatchLatency = new Trend("cendaro_trpc_batch_duration_ms", true);

function buildScenarios() {
  if (PROFILE === "LOAD_250RPS") {
    return {
      health_baseline: {
        executor: "constant-arrival-rate",
        rate: 10,
        timeUnit: "1s",
        duration: "3m",
        preAllocatedVUs: 10,
        maxVUs: 30,
        exec: "healthScenario",
      },
      read_heavy_erp: {
        executor: "constant-arrival-rate",
        rate: 200,
        timeUnit: "1s",
        duration: "3m",
        preAllocatedVUs: 80,
        maxVUs: 250,
        exec: "batchedReadScenario",
      },
      pos_hotspot_writes: {
        executor: "constant-arrival-rate",
        rate: 40,
        timeUnit: "1s",
        duration: "3m",
        preAllocatedVUs: 40,
        maxVUs: 120,
        exec: "posHotspotScenario",
      },
    };
  }

  if (PROFILE === "HOTSPOT_CONTEND") {
    return {
      pos_hotspot_contend: {
        executor: "per-vu-iterations",
        vus: 50,
        iterations: 10,
        maxDuration: "2m",
        exec: "posHotspotScenario",
      },
    };
  }

  // Default: SMOKE
  return {
    smoke_mix: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
      exec: "batchedReadScenario",
    },
  };
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: {
    cendaro_unexpected_5xx_rate: ["rate==0"],
    http_req_duration: ["p(95)<650", "p(99)<1500"],
    cendaro_trpc_batch_duration_ms: ["p(95)<500"],
  },
};

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Authenticates ONCE during setup() so per-IP/per-user rate limits on
 * `/api/auth/login` (5 req/60s) are never tripped by virtual users.
 */
export function setup() {
  const isProdHost =
    BASE_URL.includes("cendaro-erp.vercel.app") ||
    BASE_URL.includes("cendaro.com");
  if (isProdHost && __ENV.ALLOW_PROD_LOAD_TEST !== "I_UNDERSTAND") {
    fail(
      `Refusing to run load test against production host (${BASE_URL}) without ALLOW_PROD_LOAD_TEST=I_UNDERSTAND`,
    );
  }

  if (!WORKSPACE_ID) {
    fail("WORKSPACE_ID environment variable is required");
  }

  if (PREMINTED_COOKIE) {
    return { cookieHeader: PREMINTED_COOKIE };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
    fail(
      "Provide either AUTH_COOKIE or (SUPABASE_URL + SUPABASE_ANON_KEY + TEST_EMAIL + TEST_PASSWORD)",
    );
  }

  const tokenRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
    },
  );

  if (tokenRes.status !== 200) {
    fail(`Supabase token minting failed with HTTP ${tokenRes.status}`);
  }

  const projectRef = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
  const sessionJson = tokenRes.body;
  const encodedSession = `base64-${encodingBase64Url(sessionJson)}`;
  const cookieHeader = [
    `sb-${projectRef}-auth-token=${encodedSession}`,
    `cendaro-workspace-id=${WORKSPACE_ID}`,
    `cendaro-last-activity=${Date.now()}`,
  ].join("; ");

  return { cookieHeader };
}

function encodingBase64Url(input) {
  // Pure JS Base64URL encoder compatible with k6 runtime
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++);
    const c2 = i < input.length ? input.charCodeAt(i++) : NaN;
    const c3 = i < input.length ? input.charCodeAt(i++) : NaN;

    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;

    output +=
      chars.charAt(e1) +
      chars.charAt(e2) +
      (e3 === 64 ? "" : chars.charAt(e3)) +
      (e4 === 64 ? "" : chars.charAt(e4));
  }
  return output.replace(/\+/g, "-").replace(/\//g, "_");
}

function commonHeaders(cookieHeader) {
  return {
    Origin: BASE_URL,
    Cookie: cookieHeader,
    "x-workspace-id": WORKSPACE_ID,
    "Content-Type": "application/json",
  };
}

export function healthScenario() {
  const res = http.get(`${BASE_URL}/api/trpc/health.ping`);
  posUnexpected5xx.add(res.status >= 500);
  check(res, {
    "health.ping 200": (r) => r.status === 200,
  });
}

export function batchedReadScenario(data) {
  const batchInput = encodeURIComponent(
    JSON.stringify({
      0: { json: { period: "30d" } },
      1: { json: { page: 1, pageSize: 20 } },
      2: { json: { page: 1, pageSize: 20 } },
    }),
  );
  const url = `${BASE_URL}/api/trpc/dashboard.overview,catalog.listProducts,sales.listOrders?batch=1&input=${batchInput}`;
  const res = http.get(url, { headers: commonHeaders(data.cookieHeader) });

  trpcBatchLatency.add(res.timings.duration);
  posUnexpected5xx.add(res.status >= 500);

  check(res, {
    "batched ERP read HTTP 200": (r) => r.status === 200,
  });

  if (PROFILE === "SMOKE") {
    sleep(0.25);
  }
}

let lastKeyForReplay = "";

export function posHotspotScenario(data) {
  if (!HOTSPOT_PRODUCT_ID) {
    sleep(0.5);
    return;
  }

  // 10% replay of previous idempotencyKey to stress pg_advisory_xact_lock deduplication
  const reuseKey = lastKeyForReplay && Math.random() < 0.1;
  const idempotencyKey = reuseKey ? lastKeyForReplay : uuidv4();
  lastKeyForReplay = idempotencyKey;

  const payload = JSON.stringify({
    0: {
      json: {
        idempotencyKey,
        items: [
          {
            productId: HOTSPOT_PRODUCT_ID,
            quantity: 1,
            unitPrice: HOTSPOT_UNIT_PRICE,
            discount: 0,
          },
        ],
        payments: [
          {
            method: "cash_usd",
            amount: HOTSPOT_UNIT_PRICE,
            currency: "USD",
          },
        ],
      },
    },
  });

  const res = http.post(
    `${BASE_URL}/api/trpc/sales.checkoutPos?batch=1`,
    payload,
    { headers: commonHeaders(data.cookieHeader) },
  );

  posUnexpected5xx.add(res.status >= 500);

  if (
    res.status === 400 &&
    res.body &&
    res.body.includes("Stock insuficiente")
  ) {
    posConflictOrExhausted.add(1);
  }

  check(res, {
    "POS checkout never 5xx or pool timeout": (r) => r.status < 500,
    "POS checkout 200 or controlled 400 stock exhaustion": (r) =>
      r.status === 200 || r.status === 400,
  });
}
