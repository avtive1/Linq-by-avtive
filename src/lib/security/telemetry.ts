type SecurityEventLevel = "info" | "warn" | "error";

type SecurityEvent = {
  event: string;
  level?: SecurityEventLevel;
  actorId?: string;
  requestId?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
};

function redact(details?: Record<string, unknown>) {
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

export function logSecurityEvent(payload: SecurityEvent) {
  const level = payload.level ?? "info";
  const body = {
    ts: new Date().toISOString(),
    event: payload.event,
    actorId: payload.actorId,
    requestId: payload.requestId,
    resourceId: payload.resourceId,
    details: redact(payload.details),
  };

  if (level === "error") {
    console.error("[security]", body);
  } else if (level === "warn") {
    console.warn("[security]", body);
  } else {
    console.log("[security]", body);
  }
}
