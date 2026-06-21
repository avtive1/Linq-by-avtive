-- Attendance codes and check-in status for event attendees (guest + visitor).

ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS attendance_code text NULL,
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendees_attendance_code_format'
  ) THEN
    ALTER TABLE public.attendees
      ADD CONSTRAINT attendees_attendance_code_format
      CHECK (attendance_code IS NULL OR attendance_code ~ '^\d{6}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS attendees_event_attendance_code_uidx
  ON public.attendees (event_id, attendance_code)
  WHERE attendance_code IS NOT NULL;
