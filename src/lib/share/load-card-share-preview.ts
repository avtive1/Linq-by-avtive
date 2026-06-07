import { queryNeonOne } from "@/lib/neon-db";
import { isValidUuid } from "@/lib/validation/uuid";

export type CardSharePreview = {
  id: string;
  name: string;
  eventName: string;
  eventId: string;
  role: string;
  company: string;
  cardPreviewUrl: string;
};

export async function loadCardSharePreview(cardId: string): Promise<CardSharePreview | null> {
  if (!isValidUuid(cardId)) return null;

  const record = await queryNeonOne<{
    id: string;
    name: string | null;
    event_name: string | null;
    event_id: string | null;
    role: string | null;
    company: string | null;
    card_preview_url: string | null;
  }>(
    `SELECT id, name, event_name, event_id, role, company, card_preview_url
     FROM public.attendees
     WHERE id = $1`,
    [cardId],
  );

  if (!record?.id) return null;

  return {
    id: String(record.id),
    name: String(record.name || "Attendee").trim(),
    eventName: String(record.event_name || "Event").trim(),
    eventId: String(record.event_id || "").trim(),
    role: String(record.role || "").trim(),
    company: String(record.company || "").trim(),
    cardPreviewUrl: String(record.card_preview_url || "").trim(),
  };
}
