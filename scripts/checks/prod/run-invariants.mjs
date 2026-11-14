#!/usr/bin/env node
/**
 * Runs financial-invariants.sql AND (once migration 033 is applied)
 * `public.verify_audit_chain_integrity()`, failing and dispatching Slack/Sentry
 * alerts if any invariant has violations or if the production database is
 * unreachable / paused (`INACTIVE`). Prints only aggregate counts — never PII.
 *
 *   PRODUCTION_MONITOR_URL=<connection string> node scripts/checks/prod/run-invariants.mjs
 */
import { appendFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sendMonitorAlert } from "./alert-monitor.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Client } = createRequire(
  path.join(here, "../../../packages/db/package.json"),
)("pg");

const connectionString = process.env.PRODUCTION_MONITOR_URL;
if (!connectionString) {
  console.error("Missing PRODUCTION_MONITOR_URL");
  process.exit(2);
}

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

try {
  await client.connect();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[run-invariants] Database connection failed: ${message}`);
  await sendMonitorAlert({
    title: "Base de datos de producción inaccesible o pausada (INACTIVE)",
    checkSuite: "financial-invariants",
    reason: message,
  });
  process.exit(1);
}

try {
  const { rows: financialRows } = await client.query(
    readFileSync(path.join(here, "financial-invariants.sql"), "utf8"),
  );

  // Check whether migration 033 (`verify_audit_chain_integrity`) is installed
  const { rows: fnCheck } = await client.query(
    `SELECT to_regprocedure('public.verify_audit_chain_integrity()') IS NOT NULL AS installed`,
  );

  /** @type {{ invariant: string; violations: number }[]} */
  let auditRows = [];
  if (fnCheck[0]?.installed) {
    const res = await client.query(
      `SELECT invariant, violations FROM public.verify_audit_chain_integrity()`,
    );
    auditRows = res.rows;
  } else {
    console.warn(
      "[run-invariants] public.verify_audit_chain_integrity() not yet installed (pending migration 033); skipping audit-chain digest check.",
    );
  }

  const allRows = [...financialRows, ...auditRows].map((row) => ({
    invariant: String(row.invariant),
    violations: Number(row.violations),
  }));

  for (const row of allRows) {
    console.log(`${String(row.violations).padStart(6)}  ${row.invariant}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const mdLines = [
      "### Invariantes Financieros y Cadena de Auditoría",
      "| Invariante | Violaciones |",
      "| :--- | ---: |",
      ...allRows.map((r) => `| \`${r.invariant}\` | ${r.violations} |`),
      "",
    ];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${mdLines.join("\n")}\n`);
  }

  const broken = allRows.filter((row) => row.violations > 0);
  if (broken.length > 0) {
    console.error(`${broken.length} invariant(s) broken`);
    await sendMonitorAlert({
      title: `${broken.length} invariante(s) financiero(s)/auditoría con desviaciones`,
      checkSuite: "financial-invariants",
      violations: broken,
    });
    process.exitCode = 1;
  }
} finally {
  await client.end().catch(() => undefined);
}
