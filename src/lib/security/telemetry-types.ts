export type SecurityEventLevel = "info" | "warn" | "error";

export type SecurityEvent = {
  event: string;
  level?: SecurityEventLevel;
  actorId?: string;
  requestId?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
};
