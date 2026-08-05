import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import {
  attendanceCodesMatch,
  generateSixDigitAttendanceCode,
  isValidAttendanceCodeFormat,
} from "@/lib/attendance-code";
import { parseAndVerifyAttendanceQrPayload } from "@/lib/security/attendance-qr";
import { getEventStatus } from "@/lib/utils";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";

const MAX_ASSIGN_ATTEMPTS = 12;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: string }).code) === "23505"
  );
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
