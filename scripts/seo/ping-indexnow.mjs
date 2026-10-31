#!/usr/bin/env node
/**
 * Universal SEO & GEO Auto-Discovery Dispatcher
 * (PLAN-2026-10-MAESTRO-SEO-GEO-AI-MARKETING §5.5 & §11).
 *
 * Automatically notifies Google, Bing, and AI Search Engines whenever a push to
 * `main` occurs or a new page is added to the marketing site:
 *
 *   1. Dynamic URL Discovery: reads `routes.ts` & `features.ts` from disk and
 *      merges any `<loc>` entries from the live `/sitemap.xml` (no hardcoded
 *      route maintenance required).
 *   2. Edge Cache Warmup: fetches `/sitemap.xml`, `/feed.xml`, `/llms.txt` and
 *      `/llms-full.txt` so the CDN edge is warm before crawlers arrive.
 *   3. Google WebSub / PubSubHubbub (`https://pubsubhubbub.appspot.com/`):
 *      zero-credential real-time push notification for `/feed.xml` and
 *      `/sitemap.xml` so Googlebot discovers updates immediately.
 *   4. IndexNow (`https://api.indexnow.org/indexnow`): instant push to Bing,
 *      Microsoft Copilot, ChatGPT Search (`OAI-SearchBot`), Yandex, Naver and
 *      Seznam.
 *   5. Google Search Console Sitemaps API (`webmasters/v3`): when optional
 *      `GSC_SERVICE_ACCOUNT_KEY` JSON is present in the environment, signs a
 *      JWT via `node:crypto` (zero external dependencies) and submits both
 *      `/sitemap.xml` and `/feed.xml` directly to Google Search Console.
 *
 * Flags:
 *   --on-production-build   Runs only when VERCEL_ENV === "production"; never
 *                           fails the build if an external endpoint times out.
 *   --wait-deploy           Waits 25s before warming cache & pinging (used by
 *                           GitHub Actions on push to `main`).
 *   --dry-run               Prints discovered URLs and exits 0 without network
 *                           calls.
 */
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

const DEFAULT_SITE_URL = "https://cendaro-erp.vercel.app";
const INDEXNOW_KEY = "cendaro8f4a2e9b1d6c3a5f7e0b2d4c6";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const GOOGLE_WEBSUB_HUB = "https://pubsubhubbub.appspot.com/";
const REQUEST_TIMEOUT_MS = 10_000;

const args = new Set(process.argv.slice(2));
const isProductionBuildHook = args.has("--on-production-build");
const shouldWaitDeploy = args.has("--wait-deploy");
const isDryRun = args.has("--dry-run");

if (isProductionBuildHook && process.env.VERCEL_ENV !== "production") {
  console.log(
    "[seo-notify] Skipping post-build ping (VERCEL_ENV is not 'production').",
  );
  process.exit(0);
}

const rawOrigin =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
const siteOrigin = new URL(rawOrigin);

/**
 * Dynamically extracts all marketing paths from `routes.ts` and `features.ts`
 * so adding a new page automatically registers it for Google & Bing indexing.
 */
function discoverLocalPaths() {
  const paths = new Set([
    "/",
    "/funciones",
    "/sitemap.xml",
    "/feed.xml",
    "/llms.txt",
    "/llms-full.txt",
  ]);

  const routesFile = resolve(
    REPO_ROOT,
    "apps/erp/src/app/_components/landing/routes.ts",
  );
  if (existsSync(routesFile)) {
    const content = readFileSync(routesFile, "utf8");
    for (const match of content.matchAll(/path:\s*"([^"]+)"/g)) {
      if (match[1]?.startsWith("/")) {
        paths.add(match[1]);
      }
    }
  }

  const featuresFile = resolve(
    REPO_ROOT,
    "apps/erp/src/app/_components/landing/features.ts",
  );
  if (existsSync(featuresFile)) {
    const content = readFileSync(featuresFile, "utf8");
    const slugBlock = /FEATURE_SLUGS\s*=\s*\[([\s\S]*?)\]\s*as\s*const/.exec(
      content,
    )?.[1];
    if (slugBlock) {
      for (const match of slugBlock.matchAll(/"([a-z0-9-]+)"/g)) {
        if (match[1]) {
          paths.add(`/funciones/${match[1]}`);
        }
      }
    }
  }

  return [...paths];
}

/** Fetches the live `/sitemap.xml` and extracts any additional `<loc>` URLs. */
async function discoverLiveSitemapUrls(origin) {
  const sitemapUrl = new URL("/sitemap.xml", origin).href;
  try {
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1]?.trim())
      .filter((u) => Boolean(u));
  } catch {
    return [];
  }
}

/** Warms up public SEO/GEO endpoints on the CDN before crawlers arrive. */
async function warmPublicEndpoints(origin) {
  const targets = ["/sitemap.xml", "/feed.xml", "/llms.txt", "/llms-full.txt"];
  await Promise.allSettled(
    targets.map((path) =>
      fetch(new URL(path, origin).href, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
    ),
  );
}

/** Channel 1: Google WebSub / PubSubHubbub (`https://pubsubhubbub.appspot.com/`). */
async function pingGoogleWebSub(origin) {
  const feedUrl = new URL("/feed.xml", origin).href;
  const sitemapUrl = new URL("/sitemap.xml", origin).href;
  const body = new URLSearchParams();
  body.append("hub.mode", "publish");
  body.append("hub.url", feedUrl);
  body.append("hub.url", sitemapUrl);

  const res = await fetch(GOOGLE_WEBSUB_HUB, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.ok || res.status === 204) {
    console.log(
      `[seo-notify] Google WebSub Hub notified (HTTP ${res.status}): ${feedUrl} & ${sitemapUrl}`,
    );
  } else {
    const text = await res.text().catch(() => "");
    console.warn(
      `[seo-notify] Google WebSub Hub returned HTTP ${res.status}: ${text}`,
    );
  }
}

/** Channel 2: IndexNow (Bing, Microsoft Copilot, ChatGPT Search, Yandex, Naver). */
async function pingIndexNow(origin, urlList) {
  const payload = {
    host: origin.host,
    key: INDEXNOW_KEY,
    keyLocation: new URL(`/${INDEXNOW_KEY}.txt`, origin).href,
    urlList,
  };

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.ok || res.status === 202) {
    console.log(
      `[seo-notify] IndexNow accepted ${urlList.length} URLs for ${origin.host} (HTTP ${res.status}).`,
    );
  } else {
    const text = await res.text().catch(() => "");
    console.warn(
      `[seo-notify] IndexNow returned HTTP ${res.status}: ${text}`,
    );
  }
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Channel 3: Google Search Console Sitemaps API (`webmasters/v3`) using
 * zero-dependency JWT signing (`node:crypto`) when `GSC_SERVICE_ACCOUNT_KEY`
 * is present.
 */
async function submitToGoogleSearchConsole(origin) {
  const rawCreds = process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (!rawCreds) {
    console.log(
      "[seo-notify] GSC_SERVICE_ACCOUNT_KEY not set — relying on Google WebSub real-time push + robots.txt sitemap discovery.",
    );
    return;
  }

  const creds = JSON.parse(rawCreds);
  if (!creds.client_email || !creds.private_key) {
    console.warn(
      "[seo-notify] GSC_SERVICE_ACCOUNT_KEY is missing client_email or private_key.",
    );
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/webmasters",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claimSet}`);
  signer.end();
  const signature = signer
    .sign(creds.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const assertion = `${header}.${claimSet}.${signature}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    console.warn(
      `[seo-notify] Google OAuth2 token exchange returned HTTP ${tokenRes.status}: ${errText}`,
    );
    return;
  }

  const { access_token: accessToken } = await tokenRes.json();
  const siteProperty = `${origin.origin}/`;

  for (const feedPath of ["/sitemap.xml", "/feed.xml"]) {
    const feedUrl = new URL(feedPath, origin).href;
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      siteProperty,
    )}/sitemaps/${encodeURIComponent(feedUrl)}`;

    const submitRes = await fetch(endpoint, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (submitRes.ok || submitRes.status === 204) {
      console.log(
        `[seo-notify] Google Search Console API accepted ${feedUrl} (HTTP ${submitRes.status}).`,
      );
    } else {
      const errText = await submitRes.text().catch(() => "");
      console.warn(
        `[seo-notify] Google Search Console API returned HTTP ${submitRes.status} for ${feedUrl}: ${errText}`,
      );
    }
  }
}

async function main() {
  const localUrls = discoverLocalPaths().map(
    (path) => new URL(path, siteOrigin).href,
  );

  if (isDryRun) {
    console.log("[seo-notify] Dry run — discovered URLs:");
    for (const url of localUrls) {
      console.log(`  - ${url}`);
    }
    return;
  }

  if (shouldWaitDeploy) {
    console.log(
      "[seo-notify] Waiting 25s for Vercel production deployment to propagate...",
    );
    await new Promise((r) => setTimeout(r, 25_000));
  }

  await warmPublicEndpoints(siteOrigin);
  const liveSitemapUrls = await discoverLiveSitemapUrls(siteOrigin);
  const allUrls = [...new Set([...localUrls, ...liveSitemapUrls])];

  console.log(
    `[seo-notify] Dispatching ${allUrls.length} URLs for ${siteOrigin.origin}...`,
  );

  const results = await Promise.allSettled([
    pingGoogleWebSub(siteOrigin),
    pingIndexNow(siteOrigin, allUrls),
    submitToGoogleSearchConsole(siteOrigin),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("[seo-notify] Channel warning:", r.reason);
    }
  }
}

main().catch((err) => {
  console.warn("[seo-notify] Unexpected error:", err);
  // Never fail a production build or CI pipeline due to an external ping timeout.
  process.exit(0);
});
