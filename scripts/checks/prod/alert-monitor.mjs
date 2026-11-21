#!/usr/bin/env node
/**
 * Native zero-dependency Slack + Sentry Envelope alerting for Cendaro production
 * invariant & schema-drift monitors. Never transmits customer PII — only check
 * names, violation counts, Git SHA, and workflow run metadata.
 */
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

/**
 * Parses a Sentry DSN (`https://<publicKey>@<host>/<projectId>`) into an
 * Envelope API endpoint URL and public key.
 *
 * @param {string | undefined} rawDsn
 * @returns {{ endpoint: string; publicKey: string; dsn: string } | null}
 */
export function parseSentryDsn(rawDsn) {
  const trimmed = rawDsn?.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const publicKey = parsed.username;
  const segments = parsed.pathname.split("/").filter(Boolean);
  const projectId = segments.at(-1);
  if (!publicKey || !projectId) return null;
  const basePath = segments.slice(0, -1).join("/");
  const prefix = basePath ? `/${basePath}` : "";
  return {
    endpoint: `${parsed.protocol}//${parsed.host}${prefix}/api/${projectId}/envelope/`,
    publicKey,
    dsn: trimmed,
  };
}

/**
 * Builds a newline-delimited Sentry Envelope (`event` item) for fatal production
 * invariant or availability alerts.
 *
 * @param {{
 *   dsn: string;
 *   title: string;
 *   checkSuite: string;
 *   violations?: { invariant: string; violations: number }[];
 *   extra?: Record<string, unknown>;
 *   now?: Date;
 *   eventId?: string;
 * }} opts
 * @returns {string}
 */
export function buildSentryEnvelope(opts) {
  const now = opts.now ?? new Date();
  const eventId = (opts.eventId ?? crypto.randomUUID()).replace(/-/g, "");
  const header = JSON.stringify({
    event_id: eventId,
    sent_at: now.toISOString(),
    dsn: opts.dsn,
  });
  const itemHeader = JSON.stringify({ type: "event" });
  const eventPayload = JSON.stringify({
    event_id: eventId,
    timestamp: Math.floor(now.getTime() / 1000),
    platform: "node",
    level: "fatal",
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    server_name: "cendaro-production-monitor",
    message: { formatted: opts.title },
    fingerprint: ["cendaro-production-monitor", opts.checkSuite],
    tags: {
      check_suite: opts.checkSuite,
      git_sha: process.env.GITHUB_SHA?.slice(0, 12) ?? "local",
    },
    extra: {
      violations: opts.violations ?? [],
      ...opts.extra,
    },
  });
  return `${header}\n${itemHeader}\n${eventPayload}\n`;
}

/**
 * Builds a Slack Block Kit payload summarizing broken invariants or DB outage.
 *
 * @param {{
 *   title: string;
 *   checkSuite: string;
 *   violations?: { invariant: string; violations: number }[];
 *   runUrl?: string;
 *   reason?: string;
 * }} opts
 */
export function buildSlackAlertPayload(opts) {
  const lines = (opts.violations ?? []).map(
    (v) => `• \`${v.invariant}\`: *${v.violations}* violación(es)`,
  );
  if (opts.reason) {
    lines.push(`• Detalle: \`${opts.reason}\``);
  }
  if (opts.runUrl) {
    lines.push(`• Run: <${opts.runUrl}|Ver ejecución en GitHub Actions>`);
  }

  return {
    text: `🚨 [Cendaro Prod Monitor] ${opts.title}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🚨 ${opts.title}`.slice(0, 150),
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Suite:* \`${opts.checkSuite}\`\n` +
            (lines.length > 0
              ? lines.join("\n")
              : "Revisión inmediata requerida."),
        },
      },
    ],
  };
}

/**
 * Dispatches alerts to Slack (`SLACK_MONITOR_WEBHOOK_URL` / `SLACK_ALERT_WEBHOOK_URL`)
 * and Sentry (`SENTRY_MONITOR_DSN` / `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`).
 *
 * @param {{
 *   title: string;
 *   checkSuite: string;
 *   violations?: { invariant: string; violations: number }[];
 *   reason?: string;
 *   fetchImpl?: typeof fetch;
 * }} opts
 */
export async function sendMonitorAlert(opts) {
  const fetchFn = opts.fetchImpl ?? fetch;
  const slackUrl =
    process.env.SLACK_MONITOR_WEBHOOK_URL ??
    process.env.SLACK_ALERT_WEBHOOK_URL;
  const sentryRawDsn =
    process.env.SENTRY_MONITOR_DSN ??
    process.env.SENTRY_DSN ??
    process.env.NEXT_PUBLIC_SENTRY_DSN;

  const runUrl =
    process.env.GITHUB_SERVER_URL &&
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;

  const results = { slackSent: false, sentrySent: false };

  if (slackUrl) {
    try {
      const payload = buildSlackAlertPayload({
        title: opts.title,
        checkSuite: opts.checkSuite,
        violations: opts.violations,
        reason: opts.reason,
        runUrl,
      });
      const res = await fetchFn(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5_000),
      });
      results.slackSent = res.ok;
    } catch (err) {
      console.error("[alert-monitor] Slack webhook delivery failed:", err);
    }
  }

  const parsedDsn = parseSentryDsn(sentryRawDsn);
  if (parsedDsn) {
    try {
      const envelope = buildSentryEnvelope({
        dsn: parsedDsn.dsn,
        title: opts.title,
        checkSuite: opts.checkSuite,
        violations: opts.violations,
        extra: { reason: opts.reason, runUrl },
      });
      const res = await fetchFn(parsedDsn.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-sentry-envelope",
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=cendaro-monitor/1.0, sentry_key=${parsedDsn.publicKey}`,
        },
        body: envelope,
        signal: AbortSignal.timeout(5_000),
      });
      results.sentrySent = res.ok;
    } catch (err) {
      console.error("[alert-monitor] Sentry envelope delivery failed:", err);
    }
  }

  return results;
}

// Allow standalone invocation from GitHub Actions `if: failure()` steps
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const suite = process.argv[2] ?? "production-checks-workflow";
  const reason =
    process.argv[3] ??
    "Fallo en la verificación diaria de esquemas o invariantes";
  await sendMonitorAlert({
    title: "Fallo en monitoreo diario de producción (Cendaro ERP)",
    checkSuite: suite,
    reason,
  });
}
