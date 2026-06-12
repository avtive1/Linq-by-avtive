import "server-only";

import { logger } from "@/lib/logger-server";
import { redactRecord } from "@/lib/logger-redact";
import type { SecurityEvent } from "@/lib/security/telemetry-types";

export function logSecurityEvent(payload: SecurityEvent) {
  const level = payload.level ?? "info";
  const meta = {
    channel: "security",
    ...(payload.requestId ? { requestId: payload.requestId } : {}),
    ...(payload.actorId ? { userId: payload.actorId } : {}),
    resourceId: payload.resourceId,
    ...redactRecord(payload.details),
  };

  switch (level) {
    case "error":
      logger.error(meta, payload.event);
      break;
    case "warn":
      logger.warn(meta, payload.event);
      break;
    default:
      logger.info(meta, payload.event);
  }
}
