-- Add the missing updated_at column to attendees so attendance marking can
-- timestamp check-ins. The column exists in prisma/schema.prisma but drifted
-- from the live table.
ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ(6);
