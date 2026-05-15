export type StructuredLogLevel = "debug" | "info" | "warn" | "error";

function redactRecord(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (/token|secret|key|password|plaintext|cipher/i.test(k)) {
      clone[k] = "[REDACTED]";
      continue;
    }
    clone[k] = v;
  }
  return clone;
}

type StructuredLogPayload = {
  message: string;
  level?: StructuredLogLevel;
  requestId?: string;
  details?: Record<string, unknown>;
  channel?: string;
};

/**
 * JSON lines to stdout for production log aggregation (timestamps, severity, optional request ID).
 */
export function structuredLog(payload: StructuredLogPayload) {
  const level = payload.level ?? "info";
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message: payload.message,
    channel: payload.channel,
    requestId: payload.requestId,
    details: redactRecord(payload.details),
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
