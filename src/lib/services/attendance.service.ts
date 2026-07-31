import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import {
  attendanceCodesMatch,
  generateSixDigitAttendanceCode,
  isValidAttendanceCodeFormat,
} from "@/lib/attendance-code";

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

  const event = await queryNeonOne<{ user_id: string }>(
    `SELECT user_id FROM public.events WHERE id = $1`,
    [input.eventId],
  );
  if (!event?.user_id || event.user_id !== input.ownerUserId) {
    throw new Error("Forbidden.");
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
