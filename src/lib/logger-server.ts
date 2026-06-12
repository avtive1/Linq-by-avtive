import "server-only";

import pino from "pino";
import { getLogContext } from "@/lib/logger-context";
import { redactRecord } from "@/lib/logger-redact";

export type LogMeta = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === "production";

/**
 * Base Pino instance — JSON to stdout for log shippers (Datadog, Logtail, Papertrail).
 * Set LOG_LEVEL (debug|info|warn|error) and LOG_SERVICE_NAME as needed.
 * Future: plug transports via pino.transport({ target: 'pino-datadog-logs', ... }).
 */
const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.LOG_SERVICE_NAME ?? "avtive",
  },
  formatters: {
    level(label) {
      return { severity: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

function contextualLogger() {
  const ctx = getLogContext();
  const bindings: LogMeta = {};
  if (ctx.requestId) bindings.requestId = ctx.requestId;
  if (ctx.userId) bindings.userId = ctx.userId;
  return Object.keys(bindings).length > 0 ? baseLogger.child(bindings) : baseLogger;
}

function write(
  level: "debug" | "info" | "warn" | "error",
  metaOrMsg: LogMeta | string,
  msg?: string,
): void {
  const log = contextualLogger();
  if (typeof metaOrMsg === "string") {
    log[level](metaOrMsg);
    return;
  }
  const meta = redactRecord(metaOrMsg) ?? {};
  if (msg) {
    log[level](meta, msg);
  } else if (meta.msg && typeof meta.msg === "string") {
    const { msg: message, ...rest } = meta;
    log[level](rest, message);
  } else {
    log[level](meta);
  }
}

function debug(metaOrMsg: LogMeta | string, msg?: string): void {
  write("debug", metaOrMsg, msg);
}

function info(metaOrMsg: LogMeta | string, msg?: string): void {
  write("info", metaOrMsg, msg);
}

function warn(metaOrMsg: LogMeta | string, msg?: string): void {
  write("warn", metaOrMsg, msg);
}

function error(metaOrMsg: LogMeta | string, msg?: string): void {
  write("error", metaOrMsg, msg);
}

export const logger = { debug, info, warn, error };
