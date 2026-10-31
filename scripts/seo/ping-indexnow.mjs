#!/usr/bin/env node
/**
 * IndexNow Instant Indexing Submitter (PLAN-2026-10-MAESTRO-SEO-GEO-AI-MARKETING §5.2).
 *
 * Pushes all public Cendaro ERP marketing URLs and AI knowledge files
 * (`/llms.txt`, `/llms-full.txt`, `/sitemap.xml`) to the IndexNow federation
 * (`api.indexnow.org`), which immediately propagates to Microsoft Bing,
 * Microsoft Copilot, ChatGPT Search (Bing retrieval layer), Yandex, and Naver.
 *
 * Usage:
 *   node scripts/seo/ping-indexnow.mjs --dry-run
 *   node scripts/seo/ping-indexnow.mjs
 */

const DEFAULT_SITE_URL = "https://cendaro-erp.vercel.app";
const DEFAULT_INDEXNOW_KEY = "cendaro8f4a2e9b1d6c3a5f7e0b2d4c6";

const PUBLIC_PATHS = [
  "/",
  "/funciones",
  "/funciones/inventario",
  "/funciones/importaciones",
  "/funciones/finanzas",
  "/funciones/ventas-y-pos",
  "/funciones/canales",
  "/funciones/seguridad-y-control",
  "/llms.txt",
  "/llms-full.txt",
  "/sitemap.xml",
];

const isDryRun = process.argv.includes("--dry-run");
const rawOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
const siteOrigin = new URL(rawOrigin).origin;
const key = process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY;

const payload = {
  host: new URL(siteOrigin).host,
  key,
  keyLocation: `${siteOrigin}/${key}.txt`,
  urlList: PUBLIC_PATHS.map((p) => new URL(p, siteOrigin).href),
};

if (isDryRun) {
  process.stdout.write(
    `[IndexNow dry-run] Target endpoint: https://api.indexnow.org/indexnow\n${JSON.stringify(payload, null, 2)}\n`,
  );
  process.exit(0);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const body = await response.text().catch(() => "");
  process.stderr.write(
    `[IndexNow] Submission failed with HTTP ${response.status}: ${body}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[IndexNow] Successfully submitted ${payload.urlList.length} URLs for ${payload.host} (HTTP ${response.status}).\n`,
);
