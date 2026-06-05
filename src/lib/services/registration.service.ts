import {
  decryptAttendeeSensitiveFields,
  encryptAttendeeSensitiveFields,
} from "@/lib/security/attendee-sensitive";
import { deterministicLookupTag } from "@/lib/security/crypto-envelope";
import { getNeonPool, insertRow, queryNeon, queryNeonOne, updateRows } from "@/lib/neon-db";
import { validateAttendeeCoreFields } from "@/lib/validation/attendee-fields";
import { createAttendeeCardFromPayload } from "@/lib/services/event.service";
import { ensureRegistrationRequestsSchema } from "@/lib/services/registration-schema";
import type { RegistrationRequestSummary, RegistrationStatus } from "@/lib/services/realtime.service";

export const GUEST_REGISTRATION_TRACK = "guest";

export function isGuestRegistrationTrack(track: unknown): boolean {
  return String(track || "").trim().toLowerCase() === GUEST_REGISTRATION_TRACK;
}

export type RegistrationRequestRecord = {
  id: string;
  user_id: string | null;
  event_id: string;
  organization_id: string;
  status: RegistrationStatus;
  rejection_reason: string | null;
  attendee_payload: Record<string, unknown>;
  card_email_lookup_tag: string | null;
  card_id: string | null;
  created_at: string;
  updated_at: string;
};

function summarizePayload(payload: Record<string, unknown>): Pick<
  RegistrationRequestSummary,
  "attendee_name" | "attendee_company" | "attendee_email" | "track"
> {
  const { row } = decryptAttendeeSensitiveFields(payload);
  return {
    attendee_name: String(row.name || "").trim(),
    attendee_company: String(row.company || "").trim(),
    attendee_email: String(row.card_email || "").trim(),
    track: String(row.track || "").trim(),
  };
}

export async function canReviewEventRegistrations(
  reviewerUserId: string,
  eventOwnerUserId: string,
): Promise<boolean> {
  if (reviewerUserId === eventOwnerUserId) return true;
  const membership = await queryNeonOne<{ id: string }>(
    `SELECT id
     FROM public.organization_members
     WHERE member_user_id = $1
       AND org_owner_user_id = $2
       AND status = 'active'
     LIMIT 1`,
    [reviewerUserId, eventOwnerUserId],
  );
  return Boolean(membership?.id);
}

export async function countPendingRegistrationsForEvent(eventId: string): Promise<number> {
  await ensureRegistrationRequestsSchema();
  const row = await queryNeonOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM public.registration_requests
     WHERE event_id = $1
       AND status = 'PENDING'
       AND attendee_payload->>'track' = $2`,
    [eventId, GUEST_REGISTRATION_TRACK],
  );
  return Number(row?.count || 0);
}

export async function listPendingRegistrationRequests(input: {
  eventId: string;
  reviewerUserId: string;
  limit?: number;
  offset?: number;
}): Promise<{ requests: RegistrationRequestSummary[]; total: number }> {
  await ensureRegistrationRequestsSchema();
  const event = await queryNeonOne<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM public.events WHERE id = $1`,
    [input.eventId],
  );
  if (!event?.user_id) {
    throw new Error("Event not found.");
  }
  const canReview = await canReviewEventRegistrations(input.reviewerUserId, event.user_id);
  if (!canReview) {
    return { requests: [], total: 0 };
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);

  const rows = await queryNeon<{
    id: string;
    event_id: string;
    organization_id: string;
    status: RegistrationStatus;
    rejection_reason: string | null;
    attendee_payload: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT id, event_id, organization_id, status, rejection_reason, attendee_payload, created_at
     FROM public.registration_requests
     WHERE event_id = $1
       AND status = 'PENDING'
       AND attendee_payload->>'track' = $4
     ORDER BY created_at DESC
     LIMIT $2
     OFFSET $3`,
    [input.eventId, limit, offset, GUEST_REGISTRATION_TRACK],
  );

  const countRow = await queryNeonOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM public.registration_requests
     WHERE event_id = $1
       AND status = 'PENDING'
       AND attendee_payload->>'track' = $2`,
    [input.eventId, GUEST_REGISTRATION_TRACK],
  );

  const requests = rows.map((row) => ({
    id: row.id,
    event_id: row.event_id,
    organization_id: row.organization_id,
    status: row.status,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    ...summarizePayload(row.attendee_payload || {}),
  }));

  return { requests, total: Number(countRow?.count || 0) };
}

export async function getRegistrationRequestById(
  requestId: string,
): Promise<RegistrationRequestRecord | null> {
  await ensureRegistrationRequestsSchema();
  const row = await queryNeonOne<RegistrationRequestRecord>(
    `SELECT id, user_id, event_id, organization_id, status, rejection_reason,
            attendee_payload, card_email_lookup_tag, card_id, created_at, updated_at
     FROM public.registration_requests
     WHERE id = $1`,
    [requestId],
  );
  return row || null;
}

export async function getPublicRegistrationStatus(requestId: string) {
  const row = await getRegistrationRequestById(requestId);
  if (!row) return null;

  const event = await queryNeonOne<{ name: string; short_id: string | null }>(
    `SELECT name, short_id FROM public.events WHERE id = $1`,
    [row.event_id],
  );

  const summary = summarizePayload(row.attendee_payload || {});
  return {
    id: row.id,
    status: row.status,
    rejection_reason: row.rejection_reason,
    event_id: row.event_id,
    event_name: String(event?.name || ""),
    card_id: row.card_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...summary,
  };
}

export async function isApprovedGuestCard(cardId: string): Promise<boolean> {
  await ensureRegistrationRequestsSchema();
  const row = await queryNeonOne<{ id: string }>(
    `SELECT id
     FROM public.registration_requests
     WHERE card_id = $1
       AND status = 'APPROVED'
       AND attendee_payload->>'track' = $2
     LIMIT 1`,
    [cardId, GUEST_REGISTRATION_TRACK],
  );
  return Boolean(row?.id);
}

export async function createRegistrationRequest(input: {
  eventId: string;
  userId: string | null;
  attendeeData: Record<string, unknown>;
}): Promise<RegistrationRequestRecord> {
  await ensureRegistrationRequestsSchema();

  if (!isGuestRegistrationTrack(input.attendeeData.track)) {
    throw new Error("Only guest registrations require organizer approval.");
  }

  const validation = validateAttendeeCoreFields(input.attendeeData);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const event = await queryNeonOne<{ id: string; user_id: string; name: string }>(
    `SELECT id, user_id, name FROM public.events WHERE id = $1`,
    [input.eventId],
  );
  if (!event?.user_id) {
    throw new Error("Event not found.");
  }

  const payload: Record<string, unknown> = { ...validation.payload, event_id: input.eventId };
  const securePayload = encryptAttendeeSensitiveFields(payload) as Record<string, unknown>;

  let cardEmailLookupTag: string | null = null;
  const email = String(input.attendeeData.card_email || "").trim().toLowerCase();
  if (email) {
    try {
      cardEmailLookupTag = deterministicLookupTag(email, "attendees.card_email");
    } catch {
      cardEmailLookupTag = null;
    }
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = await insertRow(
      "registration_requests",
      {
        user_id: input.userId,
        event_id: input.eventId,
        organization_id: event.user_id,
        status: "PENDING",
        attendee_payload: securePayload,
        card_email_lookup_tag: cardEmailLookupTag,
      },
      "id, user_id, event_id, organization_id, status, rejection_reason, attendee_payload, card_email_lookup_tag, card_id, created_at, updated_at",
    );
  } catch (error: unknown) {
    const isUniqueViolation =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      String((error as { code?: string }).code) === "23505";
    if (isUniqueViolation) {
      throw new Error("You already have a pending registration request for this event.");
    }
    const message = error instanceof Error ? error.message : "Failed to create registration request.";
    throw new Error(message);
  }

  if (!data?.id) {
    throw new Error("Failed to create registration request.");
  }

  return data as unknown as RegistrationRequestRecord;
}

export async function approveRegistrationRequest(input: {
  requestId: string;
  reviewerUserId: string;
}): Promise<{
  request: RegistrationRequestRecord;
  cardId: string;
  shareToken: string | null;
  attendeeEmail: string;
  eventName: string;
  eventShortId: string | null;
}> {
  await ensureRegistrationRequestsSchema();

  const existing = await getRegistrationRequestById(input.requestId);
  if (!existing) {
    throw new Error("Registration request not found.");
  }

  const event = await queryNeonOne<{ user_id: string; name: string; short_id: string | null }>(
    `SELECT user_id, name, short_id FROM public.events WHERE id = $1`,
    [existing.event_id],
  );
  if (!event?.user_id) {
    throw new Error("Event not found.");
  }

  const canReview = await canReviewEventRegistrations(input.reviewerUserId, event.user_id);
  if (!canReview) {
    throw new Error("Forbidden.");
  }

  if (existing.status === "APPROVED" && existing.card_id) {
    const summary = summarizePayload(existing.attendee_payload || {});
    return {
      request: existing,
      cardId: existing.card_id,
      shareToken: null,
      attendeeEmail: summary.attendee_email,
      eventName: event.name,
      eventShortId: event.short_id,
    };
  }

  if (existing.status !== "PENDING") {
    throw new Error("Registration request already reviewed.");
  }

  const pool = getNeonPool();
  const client = await pool.connect();
  let updatedRequest: RegistrationRequestRecord;

  try {
    await client.query("BEGIN");
    const updateResult = await client.query<RegistrationRequestRecord>(
      `UPDATE public.registration_requests
       SET status = 'APPROVED',
           reviewed_by_user_id = $2,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $1
         AND status = 'PENDING'
       RETURNING id, user_id, event_id, organization_id, status, rejection_reason,
                 attendee_payload, card_email_lookup_tag, card_id, created_at, updated_at`,
      [input.requestId, input.reviewerUserId],
    );
    updatedRequest = updateResult.rows[0];
    if (!updatedRequest) {
      throw new Error("Registration request already reviewed.");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const { row: attendeePayload } = decryptAttendeeSensitiveFields(
    updatedRequest.attendee_payload || {},
  );

  try {
    const { data: cardData, shareToken } = await createAttendeeCardFromPayload({
      payload: attendeePayload,
      authUserId: null,
      forcePublicRegistration: true,
    });
    const cardId = String(cardData.id || "").trim();
    if (!cardId) {
      throw new Error("Failed to create attendee card.");
    }

    await updateRows(
      "registration_requests",
      { card_id: cardId, updated_at: new Date().toISOString() },
      { id: input.requestId },
      "id",
    );

    const finalRequest: RegistrationRequestRecord = {
      ...updatedRequest,
      card_id: cardId,
    };

    return {
      request: finalRequest,
      cardId,
      shareToken,
      attendeeEmail: String(attendeePayload.card_email || "").trim(),
      eventName: event.name,
      eventShortId: event.short_id,
    };
  } catch (cardError) {
    await updateRows(
      "registration_requests",
      {
        status: "PENDING",
        reviewed_by_user_id: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { id: input.requestId, status: "APPROVED" },
      "id",
    );
    throw cardError;
  }
}

export async function rejectRegistrationRequest(input: {
  requestId: string;
  reviewerUserId: string;
  reason: string;
}): Promise<{
  request: RegistrationRequestRecord;
  attendeeEmail: string;
  eventName: string;
  eventShortId: string | null;
}> {
  await ensureRegistrationRequestsSchema();
  const reason = String(input.reason || "").trim();
  if (!reason) {
    throw new Error("rejectionReason is required.");
  }

  const existing = await getRegistrationRequestById(input.requestId);
  if (!existing) {
    throw new Error("Registration request not found.");
  }

  const event = await queryNeonOne<{ user_id: string; name: string; short_id: string | null }>(
    `SELECT user_id, name, short_id FROM public.events WHERE id = $1`,
    [existing.event_id],
  );
  if (!event?.user_id) {
    throw new Error("Event not found.");
  }

  const canReview = await canReviewEventRegistrations(input.reviewerUserId, event.user_id);
  if (!canReview) {
    throw new Error("Forbidden.");
  }

  if (existing.status === "REJECTED") {
    const summary = summarizePayload(existing.attendee_payload || {});
    return {
      request: existing,
      attendeeEmail: summary.attendee_email,
      eventName: event.name,
      eventShortId: event.short_id,
    };
  }

  if (existing.status !== "PENDING") {
    throw new Error("Registration request already reviewed.");
  }

  const updated = await updateRows(
    "registration_requests",
    {
      status: "REJECTED",
      rejection_reason: reason,
      reviewed_by_user_id: input.reviewerUserId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { id: input.requestId, status: "PENDING" },
    "id, user_id, event_id, organization_id, status, rejection_reason, attendee_payload, card_email_lookup_tag, card_id, created_at, updated_at",
  );

  if (!updated.length) {
    const latest = await getRegistrationRequestById(input.requestId);
    if (latest?.status === "REJECTED") {
      const summary = summarizePayload(latest.attendee_payload || {});
      return {
        request: latest,
        attendeeEmail: summary.attendee_email,
        eventName: event.name,
        eventShortId: event.short_id,
      };
    }
    throw new Error("Registration request already reviewed.");
  }

  const request = updated[0] as unknown as RegistrationRequestRecord;
  const summary = summarizePayload(request.attendee_payload || {});
  return {
    request,
    attendeeEmail: summary.attendee_email,
    eventName: event.name,
    eventShortId: event.short_id,
  };
}
