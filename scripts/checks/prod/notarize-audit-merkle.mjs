#!/usr/bin/env node
/**
 * Daily external cryptographic Merkle-root notarization for `public.audit_log`.
 *
 * Reads ONLY non-PII header columns (`id`, `workspace_id`, `seq`, `prev_hash`,
 * `chain_hash`, `created_at`) via `monitor_reader` (migration 033), verifies
 * linear `prev_hash -> chain_hash` linkage, computes an RFC 6962 SHA-256 Merkle
 * root, writes a signed JSON receipt, appends the root to `$GITHUB_STEP_SUMMARY`,
 * and optionally anchors to an external HTTPS notary / WORM webhook
 * (`AUDIT_NOTARIZATION_WEBHOOK_URL`).
 *
 * Usage:
 *   PRODUCTION_MONITOR_URL=<url> node scripts/checks/prod/notarize-audit-merkle.mjs [--out checkpoint.json] [--strict]
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sendMonitorAlert } from "./alert-monitor.mjs";
import {
  buildNotarizationCheckpoint,
  signCheckpointEd25519,
} from "./audit-merkle-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Client } = createRequire(
  path.join(here, "../../../packages/db/package.json"),
)("pg");

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const strictMode = args.includes("--strict");

const connectionString = process.env.PRODUCTION_MONITOR_URL;
if (!connectionString) {
  console.error("Missing PRODUCTION_MONITOR_URL");
  process.exit(2);
}

// Default window: previous complete 24h UTC day `[yesterday 00:00Z, today 00:00Z)`
const now = new Date();
const todayUtcMidnight = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
);
const yesterdayUtcMidnight = new Date(
  todayUtcMidnight.getTime() - 24 * 60 * 60 * 1000,
);

const windowEnd =
  process.env.AUDIT_WINDOW_END ?? todayUtcMidnight.toISOString();
const windowStart =
  process.env.AUDIT_WINDOW_START ?? yesterdayUtcMidnight.toISOString();

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 20_000,
});

await client.connect();

try {
  // Check whether migration 033 column grants on `public.audit_log` are active
  const { rows: privRows } = await client.query(
    `SELECT has_column_privilege(current_user, 'public.audit_log', 'chain_hash', 'SELECT') AS allowed`,
  );
  if (!privRows[0]?.allowed) {
    const msg =
      "[notarize-audit-merkle] monitor_reader lacks SELECT(chain_hash) on public.audit_log (apply migration 033_monitor_audit_chain.sql).";
    if (strictMode) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`${msg} Skipping until migration 033 is applied.`);
    process.exit(0);
  }

  const { rows } = await client.query(
    `SELECT workspace_id, seq, prev_hash, chain_hash
     FROM public.audit_log
     WHERE chain_hash IS NOT NULL
       AND created_at >= $1::timestamptz
       AND created_at < $2::timestamptz
     ORDER BY seq ASC`,
    [windowStart, windowEnd],
  );

  // If the daily window had 0 new rows, also snapshot latest per-workspace chain tips
  const mappedRows = rows.map((r) => ({
    workspaceId: r.workspace_id ? String(r.workspace_id) : null,
    seq: String(r.seq),
    prevHash: String(r.prev_hash),
    chainHash: String(r.chain_hash),
  }));

  const checkpoint = buildNotarizationCheckpoint({
    windowStart,
    windowEnd,
    rows: mappedRows,
  });

  const ed25519Key = process.env.AUDIT_NOTARY_ED25519_PRIVATE_KEY;
  const signature = ed25519Key
    ? signCheckpointEd25519(checkpoint.canonicalJson, ed25519Key)
    : null;

  const envelope = {
    ...checkpoint.statement,
    checkpointDigest: checkpoint.checkpointDigest,
    signatureAlgorithm: signature ? "ed25519" : null,
    signature,
    notarizedAt: new Date().toISOString(),
  };

  if (outPath) {
    mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    writeFileSync(
      path.resolve(outPath),
      `${JSON.stringify(envelope, null, 2)}\n`,
    );
  }

  console.log(
    `[notarize-audit-merkle] OK rows=${envelope.rowCount} merkleRoot=${envelope.merkleRoot} digest=${envelope.checkpointDigest}`,
  );

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      "### Anclaje Criptográfico Diario (`audit_log` RFC 6962 Merkle Root)",
      `- **Ventana UTC**: \`${envelope.windowStart}\` → \`${envelope.windowEnd}\``,
      `- **Registros encadenados**: \`${envelope.rowCount}\` (\`seq\`: \`${envelope.minSeq ?? "—"}\` .. \`${envelope.maxSeq ?? "—"}\`)`,
      `- **Merkle Root (SHA-256)**: \`${envelope.merkleRoot}\``,
      `- **Checkpoint Digest**: \`${envelope.checkpointDigest}\``,
      `- **Firma Ed25519**: \`${signature ? "firmado" : "no configurada"}\``,
      "",
    ];
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `${summaryLines.join("\n")}\n`,
    );
  }

  const webhookUrl = process.env.AUDIT_NOTARIZATION_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cendaro-Checkpoint-Digest": envelope.checkpointDigest,
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(
        `External notarization webhook returned HTTP ${res.status}`,
      );
    }
  }
} catch (err) {
  const reason = err instanceof Error ? err.message : String(err);
  console.error(`[notarize-audit-merkle] FAILED: ${reason}`);
  await sendMonitorAlert({
    title: "Fallo en notarización criptográfica Merkle de audit_log",
    checkSuite: "audit-merkle-notarization",
    reason,
  });
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
