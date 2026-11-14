export interface MonitorViolation {
  invariant: string;
  violations: number;
}

export interface ParsedSentryDsn {
  endpoint: string;
  publicKey: string;
  dsn: string;
}

export function parseSentryDsn(
  rawDsn: string | undefined,
): ParsedSentryDsn | null;

export function buildSentryEnvelope(opts: {
  dsn: string;
  title: string;
  checkSuite: string;
  violations?: MonitorViolation[];
  extra?: Record<string, unknown>;
  now?: Date;
  eventId?: string;
}): string;

export function buildSlackAlertPayload(opts: {
  title: string;
  checkSuite: string;
  violations?: MonitorViolation[];
  runUrl?: string;
  reason?: string;
}): {
  text: string;
  blocks: Record<string, unknown>[];
};

export function sendMonitorAlert(opts: {
  title: string;
  checkSuite: string;
  violations?: MonitorViolation[];
  reason?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ slackSent: boolean; sentrySent: boolean }>;
