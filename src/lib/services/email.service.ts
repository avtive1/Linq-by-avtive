import { sendTransactionalEmail } from "@/lib/notifications/email";
import { getPublicAppUrl } from "@/lib/app-url";

function buildCardLink(cardId: string, shareToken?: string | null) {
  const base = getPublicAppUrl();
  const path = `/cards/${encodeURIComponent(cardId)}?share=true`;
  if (shareToken) {
    return `${base}${path}&token=${encodeURIComponent(shareToken)}`;
  }
  return `${base}${path}`;
}

function buildEventRegistrationLink(eventId: string, shortId?: string | null) {
  const base = getPublicAppUrl();
  const slug = String(shortId || eventId).trim();
  return `${base}/r/${encodeURIComponent(slug)}`;
}

export async function sendRegistrationApprovedEmail(input: {
  to: string;
  eventName: string;
  cardId: string;
  shareToken?: string | null;
  eventId: string;
  eventShortId?: string | null;
}) {
  const cardLink = buildCardLink(input.cardId, input.shareToken);
  const eventLink = buildEventRegistrationLink(input.eventId, input.eventShortId);
  const text =
    `Your event registration for "${input.eventName}" is approved!\n\n` +
    `View your attendee card:\n${cardLink}\n\n` +
    `Event page:\n${eventLink}\n\n` +
    `We look forward to seeing you at the event.`;
  return sendTransactionalEmail({
    to: input.to,
    subject: "Your Event Registration is Approved 🎉",
    text,
  });
}

export async function sendRegistrationRejectedEmail(input: {
  to: string;
  eventName: string;
  rejectionReason: string;
  eventId: string;
  eventShortId?: string | null;
}) {
  const eventLink = buildEventRegistrationLink(input.eventId, input.eventShortId);
  const text =
    `Your registration for "${input.eventName}" was not approved.\n\n` +
    `Reason: ${input.rejectionReason}\n\n` +
    `Event link: ${eventLink}\n\n` +
    `You may contact the organizer if you would like to re-apply.`;
  return sendTransactionalEmail({
    to: input.to,
    subject: "Your Event Registration Was Not Approved",
    text,
  });
}
