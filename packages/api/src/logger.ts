/**
 * Cendaro — Structured Logger
 *
 * Professional logging utility that adapts output format based on environment:
 *   • Development: Pretty-printed colored console output with icons
 *   • Production (Vercel): Structured JSON lines parseable by Vercel Log Drains,
 *     Datadog, Grafana, or any JSON-based log aggregator
 *
 * Features:
 *   • Log levels: debug, info, warn, error
 *   • Structured context (requestId, userId, path, duration)
 *   • Automatic PII redaction (emails, tokens)
 *   • Performance timing helpers
 *   • Child loggers with inherited context
 *   • Zero external dependencies
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Unique request/correlation ID for tracing */
  requestId?: string;
  /** Authenticated user ID */
  userId?: string;
  /** User role for RBAC context */
  userRole?: string;
  /** tRPC procedure path (e.g. "dashboard.salesSummary") */
  path?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** HTTP method */
  method?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Module/component name */
  module?: string;
  /** Any additional key-value pairs */
  [key: string]: unknown;
}

/**
 * Public interface for the Logger class.
 * Used in tRPC context typing to avoid exposing private class internals.
 */
export interface ILogger {
  child(context: LogContext): ILogger;
  startTimer(label: string, context?: LogContext): () => void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext, error?: unknown): void;
  error(message: string, context?: LogContext, error?: unknown): void;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test";
const LOG_LEVEL = (process.env.LOG_LEVEL ??
  (IS_PRODUCTION ? "info" : "debug")) as LogLevel;
const VERCEL_ENV = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined
const VERCEL_REGION = process.env.VERCEL_REGION; // e.g. "iad1"
const VERCEL_GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;

const SERVICE_NAME = "cendaro";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  debug: "🔍",
  info: "ℹ️ ",
  warn: "⚠️ ",
  error: "❌",
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

// PII patterns to redact
const PII_PATTERNS: [RegExp, string][] = [
  [/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "[EMAIL_REDACTED]"],
  [/(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g, "[JWT_REDACTED]"],
  [/(sk_live_[A-Za-z0-9]+)/g, "[STRIPE_KEY_REDACTED]"],
  [/(sb_[A-Za-z0-9_-]{20,})/g, "[SUPABASE_KEY_REDACTED]"],
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function shouldLog(level: LogLevel): boolean {
  if (IS_TEST) return level === "error"; // Silence in tests except errors
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

function redactPII(input: string): string {
  let result = input;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function serializeError(err: unknown): LogEntry["error"] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactPII(err.message),
      stack: IS_PRODUCTION ? undefined : err.stack,
      code: (err as Error & { code?: string }).code,
    };
  }
  return {
    name: "UnknownError",
    message: redactPII(
      err instanceof Error ? err.message : JSON.stringify(err),
    ),
  };
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ──────────────────────────────────────────────
// Output Formatters
// ──────────────────────────────────────────────

/**
 * Production: Single-line JSON (Vercel, Datadog, Grafana compatible)
 */
function formatJSON(entry: LogEntry): string {
  const output: Record<string, unknown> = {
    timestamp: entry.timestamp,
    level: entry.level,
    msg: entry.message,
    service: entry.service,
    env: entry.environment,
  };

  // Vercel-specific fields
  if (VERCEL_REGION) output.region = VERCEL_REGION;
  if (VERCEL_GIT_COMMIT_SHA) output.commit = VERCEL_GIT_COMMIT_SHA.slice(0, 7);

  // Context fields flattened for better log querying
  if (entry.context) {
    for (const [key, value] of Object.entries(entry.context)) {
      if (value !== undefined && value !== null) {
        output[key] = typeof value === "string" ? redactPII(value) : value;
      }
    }
  }

  if (entry.error) output.error = entry.error;

  return JSON.stringify(output);
}

/**
 * Development: Pretty-printed colored output
 */
function formatPretty(entry: LogEntry): string {
  const color = LEVEL_COLORS[entry.level];
  const icon = LEVEL_ICONS[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
  });
  const levelTag = `${color}${entry.level.toUpperCase().padEnd(5)}${RESET}`;

  let line = `${DIM}${time}${RESET} ${icon} ${levelTag} ${BOLD}${entry.message}${RESET}`;

  // Add context inline
  const ctx = entry.context;
  if (ctx) {
    const parts: string[] = [];
    if (ctx.path) parts.push(`path=${ctx.path}`);
    if (ctx.durationMs != null)
      parts.push(`duration=${formatDuration(ctx.durationMs)}`);
    if (ctx.userId) parts.push(`user=${ctx.userId.slice(0, 8)}…`);
    if (ctx.userRole) parts.push(`role=${ctx.userRole}`);
    if (ctx.requestId) parts.push(`req=${ctx.requestId.slice(0, 8)}…`);
    if (ctx.statusCode) parts.push(`status=${ctx.statusCode}`);
    if (ctx.module) parts.push(`module=${ctx.module}`);

    // Any extra keys not already handled
    const handledKeys = new Set([
      "path",
      "durationMs",
      "userId",
      "userRole",
      "requestId",
      "statusCode",
      "module",
      "method",
    ]);
    for (const [key, value] of Object.entries(ctx)) {
      if (!handledKeys.has(key) && value !== undefined) {
        parts.push(
          `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value as string | number | boolean)}`,
        );
      }
    }

    if (parts.length > 0) {
      line += ` ${DIM}(${parts.join(", ")})${RESET}`;
    }
  }

  // Error details
  if (entry.error) {
    line += `\n  ${color}→ ${entry.error.name}: ${entry.error.message}${RESET}`;
    if (entry.error.stack) {
      const stackLines = entry.error.stack.split("\n").slice(1, 4);
      for (const sl of stackLines) {
        line += `\n  ${DIM}${sl.trim()}${RESET}`;
      }
    }
  }

  return line;
}

// ──────────────────────────────────────────────
// Logger Class
// ──────────────────────────────────────────────

class Logger {
  /** @internal context is public to satisfy TS anonymous class export constraints */
  readonly _ctx: LogContext;

  constructor(context: LogContext = {}) {
    this._ctx = context;
  }

  /**
   * Create a child logger that inherits parent context + adds new context.
   * Useful for request-scoped logging.
   */
  child(context: LogContext): Logger {
    return new Logger({ ...this._ctx, ...context });
  }

  /**
   * Start a timer. Returns a function that, when called, logs the elapsed
   * time at the specified level.
   */
  startTimer(label: string, context?: LogContext): () => void {
    const start = performance.now();
    return () => {
      const durationMs = performance.now() - start;
      this.info(`${label} completed`, { ...context, durationMs });
    };
  }

  debug(message: string, context?: LogContext): void {
    this.#log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.#log("info", message, context);
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    this.#log("warn", message, context, error);
  }

  error(message: string, context?: LogContext, error?: unknown): void {
    this.#log("error", message, context, error);
  }

  #log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: redactPII(message),
      service: SERVICE_NAME,
      environment: VERCEL_ENV ?? (IS_PRODUCTION ? "production" : "development"),
      context: { ...this._ctx, ...context },
      error: serializeError(error),
    };

    const formatted = IS_PRODUCTION ? formatJSON(entry) : formatPretty(entry);

    switch (level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
}

// ──────────────────────────────────────────────
// Singleton & Exports
// ──────────────────────────────────────────────

/**
 * Root logger instance. Use `logger.child({ ... })` for scoped loggers.
 *
 * @example
 * ```ts
 * // Module-level
 * const log = logger.child({ module: "pricing" });
 * log.info("Rate updated", { rateType: "bcv", newRate: 52.3 });
 *
 * // Request-level (in tRPC middleware)
 * const reqLog = logger.child({ requestId, userId, path });
 * reqLog.info("Procedure started");
 * reqLog.error("Procedure failed", {}, err);
 * ```
 */
export const logger = new Logger();

/**
 * Generate a unique request ID (k-sortable, 12 chars)
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `${timestamp}-${random}`;
}
