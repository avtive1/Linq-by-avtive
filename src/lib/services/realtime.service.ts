import { EventEmitter } from "node:events";

export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type RegistrationRequestSummary = {
  id: string;
  event_id: string;
  organization_id: string;
  status: RegistrationStatus;
  attendee_name: string;
  attendee_company: string;
  attendee_email: string;
  track: string;
  created_at: string;
  rejection_reason?: string | null;
};

type RegistrationRealtimePayload = {
  requestId: string;
  eventId: string;
  organizationId: string;
  status?: RegistrationStatus;
  rejectionReason?: string;
  pendingCount?: number;
  request?: RegistrationRequestSummary;
  cardId?: string;
  shareToken?: string | null;
};

type GlobalRegistrationBus = {
  emitter: EventEmitter;
};

const GLOBAL_KEY = "__avtiveRegistrationRealtimeBus";

function getBus(): EventEmitter {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: GlobalRegistrationBus };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { emitter: new EventEmitter() };
    g[GLOBAL_KEY].emitter.setMaxListeners(100);
  }
  return g[GLOBAL_KEY].emitter;
}

function orgChannel(organizationId: string, eventId?: string) {
  return eventId ? `org:${organizationId}:event:${eventId}` : `org:${organizationId}`;
}

function userChannel(requestId: string) {
  return `registration:${requestId}`;
}

function emit(channel: string, event: string, payload: RegistrationRealtimePayload) {
  getBus().emit(channel, { event, payload });
}

export function subscribeRegistrationChannel(
  channel: string,
  listener: (message: { event: string; payload: RegistrationRealtimePayload }) => void,
) {
  const bus = getBus();
  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}

export async function emitRegistrationNewToOrg(input: {
  organizationId: string;
  eventId: string;
  payload: RegistrationRealtimePayload;
}) {
  const message = { event: "registration:new", payload: input.payload };
  emit(orgChannel(input.organizationId, input.eventId), message.event, input.payload);
  emit(orgChannel(input.organizationId), message.event, input.payload);
}

export async function emitRegistrationPendingCountUpdatedToOrg(input: {
  organizationId: string;
  eventId: string;
  pendingCount: number;
}) {
  const payload: RegistrationRealtimePayload = {
    requestId: "",
    eventId: input.eventId,
    organizationId: input.organizationId,
    pendingCount: input.pendingCount,
  };
  emit(orgChannel(input.organizationId, input.eventId), "registration:pendingCountUpdated", payload);
  emit(orgChannel(input.organizationId), "registration:pendingCountUpdated", payload);
}

export async function emitRegistrationUpdatedToOrg(input: {
  organizationId: string;
  eventId: string;
  payload: RegistrationRealtimePayload;
}) {
  emit(orgChannel(input.organizationId, input.eventId), "registration:updated", input.payload);
  emit(orgChannel(input.organizationId), "registration:updated", input.payload);
}

export async function emitRegistrationApprovedToUser(input: {
  requestId: string;
  payload: RegistrationRealtimePayload;
}) {
  emit(userChannel(input.requestId), "registration:approved", input.payload);
}

export async function emitRegistrationRejectedToUser(input: {
  requestId: string;
  payload: RegistrationRealtimePayload;
}) {
  emit(userChannel(input.requestId), "registration:rejected", input.payload);
}

export { orgChannel, userChannel };
