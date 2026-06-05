"use client";

import { useEffect, useRef } from "react";

type RegistrationRequestSummary = {
  id: string;
  event_id: string;
  organization_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  attendee_name: string;
  attendee_company: string;
  attendee_email: string;
  track: string;
  created_at: string;
  rejection_reason?: string | null;
};

type OrgRealtimeHandlers = {
  onNew?: (payload: { request?: RegistrationRequestSummary; pendingCount?: number }) => void;
  onPendingCountUpdated?: (pendingCount: number) => void;
  onUpdated?: (payload: {
    requestId: string;
    status?: string;
    rejectionReason?: string;
    cardId?: string;
    shareToken?: string | null;
    pendingCount?: number;
  }) => void;
};

export function useOrgRegistrationStream(
  eventId: string | null | undefined,
  enabled: boolean,
  handlers: OrgRealtimeHandlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !eventId) return;

    const source = new EventSource(
      `/api/registration-requests/stream?eventId=${encodeURIComponent(eventId)}`,
    );

    source.addEventListener("registration:new", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        handlersRef.current.onNew?.(payload);
      } catch {
        // ignore malformed payloads
      }
    });

    source.addEventListener("registration:pendingCountUpdated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (typeof payload.pendingCount === "number") {
          handlersRef.current.onPendingCountUpdated?.(payload.pendingCount);
        }
      } catch {
        // ignore malformed payloads
      }
    });

    source.addEventListener("registration:updated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        handlersRef.current.onUpdated?.(payload);
      } catch {
        // ignore malformed payloads
      }
    });

    return () => {
      source.close();
    };
  }, [enabled, eventId]);
}

type UserRegistrationStatus = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason?: string | null;
  card_id?: string | null;
  event_name?: string;
};

export function useRegistrationStatusStream(
  requestId: string | null | undefined,
  enabled: boolean,
  handlers: {
    onStatus?: (status: UserRegistrationStatus) => void;
    onApproved?: (payload: { cardId?: string; shareToken?: string | null }) => void;
    onRejected?: (payload: { rejectionReason?: string }) => void;
  },
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !requestId) return;

    const source = new EventSource(
      `/api/registration-requests/status/${encodeURIComponent(requestId)}/stream`,
    );

    source.addEventListener("status", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as UserRegistrationStatus;
        handlersRef.current.onStatus?.(payload);
      } catch {
        // ignore malformed payloads
      }
    });

    source.addEventListener("registration:approved", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        handlersRef.current.onApproved?.(payload);
      } catch {
        // ignore malformed payloads
      }
    });

    source.addEventListener("registration:rejected", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        handlersRef.current.onRejected?.(payload);
      } catch {
        // ignore malformed payloads
      }
    });

    return () => {
      source.close();
    };
  }, [enabled, requestId]);
}

export type { RegistrationRequestSummary, UserRegistrationStatus };
