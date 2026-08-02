-- Existing deployments may predate the attendee card-font field even though the
-- historical baseline now contains it. Reconcile the live schema forward.
ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS card_font text;
