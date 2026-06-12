"use client";

import { redactRecord } from "@/lib/logger-redact";

export type LogMeta = Record<string, unknown>;

type ClientLogLevel = "debug" | "info" | "warn" | "error";

/** Pluggable client transport (e.g. forward to observability SDK). */
export type ClientLogTransport = (level: ClientLogLevel, payload: string) => void;

let clientTransport: ClientLogTransport | null = null;

export function setClientLogTransport(transport: ClientLogTransport | null): void {
  clientTransport = transport;
}

function defaultTransport(level: ClientLogLevel, payload: string): void {
  if (!isProduction) {
    const sink =
      level === "error"
        ? globalThis.console.error
        : level === "warn"
          ? globalThis.console.warn
          : level === "debug"
            ? globalThis.console.debug
            : globalThis.console.log;
    sink.call(globalThis.console, payload);
  }
}

const isProduction = process.env.NODE_ENV === "production";

function emit(level: ClientLogLevel, metaOrMsg: LogMeta | string, msg?: string): void {
  const timestamp = new Date().toISOString();
  let payload: Record<string, unknown>;

  if (typeof metaOrMsg === "string") {
    payload = { timestamp, severity: level, message: metaOrMsg };
  } else {
    const meta = redactRecord(metaOrMsg) ?? {};
    payload = {
      timestamp,
      severity: level,
      message: msg ?? (typeof meta.msg === "string" ? meta.msg : ""),
      ...meta,
    };
    if (msg) delete payload.msg;
  }

  const line = JSON.stringify(payload);
  (clientTransport ?? defaultTransport)(level, line);
}

function debug(metaOrMsg: LogMeta | string, msg?: string): void {
  emit("debug", metaOrMsg, msg);
}

function info(metaOrMsg: LogMeta | string, msg?: string): void {
  emit("info", metaOrMsg, msg);
}

function warn(metaOrMsg: LogMeta | string, msg?: string): void {
  emit("warn", metaOrMsg, msg);
}

function error(metaOrMsg: LogMeta | string, msg?: string): void {
  emit("error", metaOrMsg, msg);
}

export const logger = { debug, info, warn, error };
