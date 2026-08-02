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

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled || !eventId) return;
    let stopped = false;
    let initialized = false;
    let knownIds = new Set<string>();

    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/events/${encodeURIComponent(eventId)}/registrations?limit=200&offset=0`,
          { cache: "no-store" },
        );
        if (!response.ok || stopped) return;
        const payload = (await response.json()) as {
          data?: { requests?: RegistrationRequestSummary[] };
          pagination?: { total?: number };
        };
        const requests = payload.data?.requests || [];
        const nextIds = new Set(requests.map((request) => request.id));

        if (initialized) {
          for (const request of requests) {
            if (!knownIds.has(request.id)) {
              handlersRef.current.onNew?.({ request });
            }
          }
          for (const id of knownIds) {
            if (!nextIds.has(id)) {
              handlersRef.current.onUpdated?.({ requestId: id, status: "REVIEWED" });
            }
          }
        }

        initialized = true;
        knownIds = nextIds;
        handlersRef.current.onPendingCountUpdated?.(
          Number(payload.pagination?.total || requests.length),
        );
      } catch {
        // A later interval retries transient dashboard refresh failures.
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [enabled, eventId]);
}

type UserRegistrationStatus = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason?: string | null;
  card_id?: string | null;
  event_name?: string;
  share_token?: string | null;
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

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled || !requestId) return;

    let stopped = false;
    let terminalStatusDelivered = false;

    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/registration-requests/${encodeURIComponent(requestId)}`,
          { cache: "no-store" },
        );
        if (!response.ok || stopped) return;
        const body = (await response.json()) as { data?: UserRegistrationStatus };
        const status = body.data;
        if (!status) return;

        handlersRef.current.onStatus?.(status);
        if (terminalStatusDelivered || status.status === "PENDING") return;
        terminalStatusDelivered = true;

        if (status.status === "APPROVED") {
          handlersRef.current.onApproved?.({
            cardId: status.card_id || undefined,
            shareToken: status.share_token || null,
          });
        } else {
          handlersRef.current.onRejected?.({
            rejectionReason: status.rejection_reason || undefined,
          });
        }
      } catch {
        // A later interval retries transient status refresh failures.
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 5_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [enabled, requestId]);
}

export type { RegistrationRequestSummary, UserRegistrationStatus };
