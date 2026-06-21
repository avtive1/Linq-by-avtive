import { queryNeonAsSystem } from "@/lib/neon-db";
import { logger } from "@/lib/logger-server";

let schemaEnsured = false;
let schemaEnsureFailed = false;

/**
 * Best-effort runtime patch when prisma migrate has not been applied yet.
 * Uses system/RLS-bypass context — never call from inside tenant-scoped reads.
 */
export async function ensureAttendeeAttendanceSchema() {
  if (schemaEnsured || schemaEnsureFailed) return;

  try {
    await queryNeonAsSystem(
      `ALTER TABLE public.attendees
       ADD COLUMN IF NOT EXISTS attendance_code text NULL`,
    );
    await queryNeonAsSystem(
      `ALTER TABLE public.attendees
       ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false`,
    );
    await queryNeonAsSystem(
      `CREATE UNIQUE INDEX IF NOT EXISTS attendees_event_attendance_code_uidx
       ON public.attendees (event_id, attendance_code)
       WHERE attendance_code IS NOT NULL`,
    );
    schemaEnsured = true;
  } catch (error: unknown) {
    schemaEnsureFailed = true;
    logger.warn(
      { err: error instanceof Error ? error : undefined },
      "Skipping attendees attendance runtime schema patch",
    );
  }
}
