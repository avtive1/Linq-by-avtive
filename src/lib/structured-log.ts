import { logger } from "@/lib/logger-server";
import { redactRecord } from "@/lib/logger-redact";

export type StructuredLogLevel = "debug" | "info" | "warn" | "error";

type StructuredLogPayload = {
  message: string;
  level?: StructuredLogLevel;
  requestId?: string;
  userId?: string;
  details?: Record<string, unknown>;
  channel?: string;
};

/**
 * @deprecated Prefer `logger` from `@/lib/logger-server` directly.
 * Retained for existing security telemetry call sites.
 */
export function structuredLog(payload: StructuredLogPayload) {
  const level = payload.level ?? "info";
  const meta = {
    ...(payload.requestId ? { requestId: payload.requestId } : {}),
    ...(payload.userId ? { userId: payload.userId } : {}),
    ...(payload.channel ? { channel: payload.channel } : {}),
    ...redactRecord(payload.details),
  };

  switch (level) {
    case "error":
      logger.error(meta, payload.message);
      break;
    case "warn":
      logger.warn(meta, payload.message);
      break;
    case "debug":
      logger.debug(meta, payload.message);
      break;
    default:
      logger.info(meta, payload.message);
  }
}
