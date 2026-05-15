import { structuredLog } from "@/lib/structured-log";

type SecurityEventLevel = "info" | "warn" | "error";

type SecurityEvent = {
  event: string;
  level?: SecurityEventLevel;
  actorId?: string;
  requestId?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
};

export function logSecurityEvent(payload: SecurityEvent) {
  const level = payload.level ?? "info";
  structuredLog({
    message: payload.event,
    level,
    requestId: payload.requestId,
    channel: "security",
    details: {
      actorId: payload.actorId,
      resourceId: payload.resourceId,
      ...payload.details,
    },
  });
}
