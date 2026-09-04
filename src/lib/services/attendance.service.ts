import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import {
  attendanceCodesMatch,
  generateSixDigitAttendanceCode,
  isValidAttendanceCodeFormat,
} from "@/lib/attendance-code";
import { parseAndVerifyAttendanceQrPayload } from "@/lib/security/attendance-qr";
import { getEventStatus } from "@/lib/utils";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { isValidUuid } from "@/lib/validation/uuid";

const MAX_ASSIGN_ATTEMPTS = 12;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: string }).code) === "23505"
  );
}

export function formatAttendeeLinkedInUrl(raw?: string | null): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.includes(".")) {
    return `https://${trimmed}`;
  }
  return `https://linkedin.com/in/${trimmed}`;
}

export function extractCardIdFromQrPayload(payload: string): string | null {
  const trimmed = String(payload || "").trim();
  const urlMatch = trimmed.match(/\/cards\/([0-9a-fA-F-]{36})(?:\/scan)?/i);
  if (urlMatch && isValidUuid(urlMatch[1])) {
    return urlMatch[1];
  }
  if (isValidUuid(trimmed)) {
    return trimmed;
  }
  return null;
}

async function readAttendanceCode(
  attendeeId: string,
  eventId: string,
): Promise<string | null> {
  const row = await queryNeonOne<{ attendance_code: string | null }>(
    `SELECT attendance_code
     FROM public.attendees
     WHERE id = $1
       AND event_id = $2
     LIMIT 1`,
    [attendeeId, eventId],
  );
  return row?.attendance_code ? String(row.attendance_code) : null;
}

/** Assign a per-event unique code to a new attendee. Skips rows that already have a code. */
export async function assignAttendanceCodeIfMissing(input: {
  attendeeId: string;
  eventId: string;
}): Promise<string | null> {
  const existing = await readAttendanceCode(input.attendeeId, input.eventId);
  if (existing) return existing;

  for (let attempt = 0; attempt < MAX_ASSIGN_ATTEMPTS; attempt++) {
    const code = generateSixDigitAttendanceCode();
    try {
      const updated = await queryNeon<{ attendance_code: string }>(
        `UPDATE public.attendees
         SET attendance_code = $3
         WHERE id = $1
           AND event_id = $2
           AND attendance_code IS NULL
         RETURNING attendance_code`,
        [input.attendeeId, input.eventId, code],
      );
      if (updated[0]?.attendance_code) {
        return String(updated[0].attendance_code);
      }

      const raced = await readAttendanceCode(input.attendeeId, input.eventId);
      if (raced) return raced;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new Error("Failed to assign attendance code.");
}

export async function markAttendeeAttended(input: {
  eventId: string;
  attendeeId: string;
  code: string;
  ownerUserId: string;
}): Promise<{ attended: boolean; alreadyAttended: boolean }> {
  const event = await queryNeonOne<{ user_id: string; date: string | null }>(
    `SELECT user_id, date FROM public.events WHERE id = $1`,
    [input.eventId],
  );
  if (!event?.user_id || event.user_id !== input.ownerUserId) {
    throw new Error("Forbidden.");
  }

  const status = getEventStatus(event.date);
  if (status.label !== "Today") {
    throw new Error("Attendance can only be marked while the event is live.");
  }

  const submittedCode = String(input.code || "").trim();
  if (!isValidAttendanceCodeFormat(submittedCode)) {
    throw new Error("Attendance code must be a 6-digit number.");
  }

  const attendee = await queryNeonOne<{ attendance_code: string | null; attended: boolean }>(
    `SELECT attendance_code, attended
     FROM public.attendees
     WHERE id = $1
       AND event_id = $2
     LIMIT 1`,
    [input.attendeeId, input.eventId],
  );
  if (!attendee) {
    throw new Error("Attendee not found.");
  }
  if (!attendee.attendance_code) {
    throw new Error("This attendee does not have an attendance code.");
  }
  if (attendee.attended) {
    return { attended: true, alreadyAttended: true };
  }
  if (!attendanceCodesMatch(attendee.attendance_code, submittedCode)) {
    throw new Error("Attendance code does not match.");
  }

  await queryNeon(
    `UPDATE public.attendees
     SET attended = true
     WHERE id = $1
       AND event_id = $2`,
    [input.attendeeId, input.eventId],
  );

  return { attended: true, alreadyAttended: false };
}

export interface AttendeeAttendanceCheckinResult {
  success: boolean;
  message: string;
  alreadyAttended: boolean;
  attendedAt?: Date | string | null;
  attendee?: {
    id: string;
    name: string;
    role: string;
    company: string;
    track: string;
    email?: string;
    linkedin?: string;
    linkedinUrl?: string;
    photoUrl?: string;
  };
  event?: {
    id: string;
    name: string;
    date?: string | null;
    time?: string | null;
    location?: string | null;
    logoUrl?: string | null;
  };
}

/**
 * Marks attendance for an attendee directly from scanning their badge QR code.
 * Identifies the attendee + event, validates registration, prevents duplicate attendance,
 * saves the timestamp server-side, and preserves LinkedIn information.
 */
export async function markAttendeeAttendanceById(
  cardId: string,
): Promise<AttendeeAttendanceCheckinResult> {
  const normalizedCardId = String(cardId || "").trim();
  if (!isValidUuid(normalizedCardId)) {
    return {
      success: false,
      message: "Invalid attendee badge identifier.",
      alreadyAttended: false,
    };
  }

  const rawAttendee = await queryNeonOne<Record<string, unknown>>(
    `SELECT id, event_id, event_name, name, role, company, track, card_email, linkedin, photo_url, attendance_code, attended, updated_at, created_at
     FROM public.attendees
     WHERE id = $1
     LIMIT 1`,
    [normalizedCardId],
  );

  if (!rawAttendee) {
    return {
      success: false,
      message: "Attendee badge not found or unrecognized QR code.",
      alreadyAttended: false,
    };
  }

  const { row: attendee } = decryptAttendeeSensitiveFields(rawAttendee);
  const eventId = String(attendee.event_id || "").trim();

  if (!eventId || !isValidUuid(eventId)) {
    return {
      success: false,
      message: "Attendee is not registered for a valid event.",
      alreadyAttended: false,
    };
  }

  const event = await queryNeonOne<{
    id: string;
    name: string;
    date: string | null;
    time: string | null;
    location: string | null;
    logo_url: string | null;
  }>(
    `SELECT id, name, date, time, location, logo_url
     FROM public.events
     WHERE id = $1
     LIMIT 1`,
    [eventId],
  );

  if (!event) {
    return {
      success: false,
      message: "Event associated with this badge could not be found.",
      alreadyAttended: false,
    };
  }

  const attendeeName = String(attendee.name || "Attendee").trim();
  const rawLinkedin = String(attendee.linkedin || "").trim();
  const linkedinUrl = formatAttendeeLinkedInUrl(rawLinkedin);

  const attendeeInfo = {
    id: String(attendee.id),
    name: attendeeName,
    role: String(attendee.role || "Attendee"),
    company: String(attendee.company || ""),
    track: String(attendee.track || ""),
    email: String(attendee.card_email || ""),
    linkedin: rawLinkedin,
    linkedinUrl,
    photoUrl: String(attendee.photo_url || ""),
  };

  const eventInfo = {
    id: event.id,
    name: event.name || String(attendee.event_name || "Exclusive Event"),
    date: event.date,
    time: event.time,
    location: event.location,
    logoUrl: event.logo_url,
  };

  if (Boolean(attendee.attended)) {
    return {
      success: true,
      alreadyAttended: true,
      message: `Attendance already marked for ${attendeeName}.`,
      attendedAt: (attendee.updated_at as Date | string) || (attendee.created_at as Date | string),
      attendee: attendeeInfo,
      event: eventInfo,
    };
  }

  // Atomic update to ensure single-use QR execution and save attendance timestamp
  const updated = await queryNeon<{ id: string; updated_at: Date | string }>(
    `UPDATE public.attendees
     SET attended = true,
         updated_at = NOW()
     WHERE id = $1
       AND event_id = $2
       AND attended = false
     RETURNING id, updated_at`,
    [normalizedCardId, eventId],
  );

  if (!updated || updated.length === 0) {
    return {
      success: true,
      alreadyAttended: true,
      message: `Attendance already marked for ${attendeeName}.`,
      attendedAt: (attendee.updated_at as Date | string) || new Date(),
      attendee: attendeeInfo,
      event: eventInfo,
    };
  }

  return {
    success: true,
    alreadyAttended: false,
    message: `Attendance marked successfully for ${attendeeName}!`,
    attendedAt: updated[0].updated_at,
    attendee: attendeeInfo,
    event: eventInfo,
  };
}

export interface MarkAttendanceScanResult {
  success: boolean;
  alreadyAttended?: boolean;
  message: string;
  attendee?: {
    id: string;
    name: string;
    role: string;
    company: string;
    track: string;
    email?: string;
  };
}

export async function markAttendanceByQrScan(input: {
  eventId: string;
  qrPayload: string;
  ownerUserId: string;
}): Promise<MarkAttendanceScanResult> {
  const event = await queryNeonOne<{ id: string; user_id: string; date: string | null }>(
    `SELECT id, user_id, date FROM public.events WHERE id = $1`,
    [input.eventId],
  );
  if (!event) {
    return { success: false, message: "Event not found." };
  }
  if (event.user_id !== input.ownerUserId) {
    return { success: false, message: "Forbidden." };
  }

  const eventStatus = getEventStatus(event.date);
  if (eventStatus.label !== "Today") {
    return {
      success: false,
      message: "Event is not live. Attendance can only be marked while the event is live.",
    };
  }

  // Support both direct badge QR URL / UUID payloads and signed JSON payloads
  const extractedCardId = extractCardIdFromQrPayload(input.qrPayload);

  if (extractedCardId) {
    const rawAttendee = await queryNeonOne<Record<string, unknown>>(
      `SELECT id, event_id, name, role, company, track, card_email, attendance_code, attended
       FROM public.attendees
       WHERE id = $1
         AND event_id = $2
       LIMIT 1`,
      [extractedCardId, input.eventId],
    );

    if (!rawAttendee) {
      return {
        success: false,
        message: "Attendee does not belong to this event.",
      };
    }

    const { row: attendee } = decryptAttendeeSensitiveFields(rawAttendee);
    const attendeeName = String(attendee.name || "Attendee");

    if (Boolean(attendee.attended)) {
      return {
        success: false,
        alreadyAttended: true,
        message: `Attendance has already been marked for ${attendeeName}.`,
        attendee: {
          id: String(attendee.id),
          name: attendeeName,
          role: String(attendee.role || ""),
          company: String(attendee.company || ""),
          track: String(attendee.track || ""),
          email: String(attendee.card_email || ""),
        },
      };
    }

    const updated = await queryNeon<{ id: string }>(
      `UPDATE public.attendees
       SET attended = true,
           updated_at = NOW()
       WHERE id = $1
         AND event_id = $2
         AND attended = false
       RETURNING id`,
      [extractedCardId, input.eventId],
    );

    if (!updated || updated.length === 0) {
      return {
        success: false,
        alreadyAttended: true,
        message: `Attendance has already been marked for ${attendeeName}.`,
        attendee: {
          id: String(attendee.id),
          name: attendeeName,
          role: String(attendee.role || ""),
          company: String(attendee.company || ""),
          track: String(attendee.track || ""),
          email: String(attendee.card_email || ""),
        },
      };
    }

    return {
      success: true,
      alreadyAttended: false,
      message: `Attendance marked successfully for ${attendeeName}.`,
      attendee: {
        id: String(attendee.id),
        name: attendeeName,
        role: String(attendee.role || ""),
        company: String(attendee.company || ""),
        track: String(attendee.track || ""),
        email: String(attendee.card_email || ""),
      },
    };
  }

  const verification = parseAndVerifyAttendanceQrPayload(input.qrPayload);
  if (!verification.valid || !verification.payload) {
    return {
      success: false,
      message: verification.reason || "Invalid QR Code payload.",
    };
  }

  const { attendeeId, eventId: payloadEventId, code } = verification.payload;

  if (payloadEventId !== input.eventId) {
    return {
      success: false,
      message: "QR Code does not belong to this event.",
    };
  }

  const rawAttendee = await queryNeonOne<Record<string, unknown>>(
    `SELECT id, event_id, name, role, company, track, card_email, attendance_code, attended
     FROM public.attendees
     WHERE id = $1
       AND event_id = $2
     LIMIT 1`,
    [attendeeId, input.eventId],
  );

  if (!rawAttendee) {
    return {
      success: false,
      message: "Attendee does not belong to this event.",
    };
  }

  const { row: attendee } = decryptAttendeeSensitiveFields(rawAttendee);

  const storedCode = String(attendee.attendance_code || "").trim();
  if (!storedCode || !attendanceCodesMatch(storedCode, code)) {
    return {
      success: false,
      message: "Invalid QR Code verification token.",
    };
  }

  const attendeeName = String(attendee.name || "Attendee");

  if (Boolean(attendee.attended)) {
    return {
      success: false,
      alreadyAttended: true,
      message: `Attendance has already been marked for ${attendeeName}.`,
      attendee: {
        id: String(attendee.id),
        name: attendeeName,
        role: String(attendee.role || ""),
        company: String(attendee.company || ""),
        track: String(attendee.track || ""),
        email: String(attendee.card_email || ""),
      },
    };
  }

  // Atomic update to ensure single-use QR execution
  const updated = await queryNeon<{ id: string }>(
    `UPDATE public.attendees
     SET attended = true,
         updated_at = NOW()
     WHERE id = $1
       AND event_id = $2
       AND attended = false
     RETURNING id`,
    [attendeeId, input.eventId],
  );

  if (!updated || updated.length === 0) {
    return {
      success: false,
      alreadyAttended: true,
      message: `Attendance has already been marked for ${attendeeName}.`,
      attendee: {
        id: String(attendee.id),
        name: attendeeName,
        role: String(attendee.role || ""),
        company: String(attendee.company || ""),
        track: String(attendee.track || ""),
        email: String(attendee.card_email || ""),
      },
    };
  }

  return {
    success: true,
    alreadyAttended: false,
    message: `Attendance marked successfully for ${attendeeName}.`,
    attendee: {
      id: String(attendee.id),
      name: attendeeName,
      role: String(attendee.role || ""),
      company: String(attendee.company || ""),
      track: String(attendee.track || ""),
      email: String(attendee.card_email || ""),
    },
  };
}

