import { sendTransactionalEmail } from "@/lib/notifications/email";
import { toPublicCompactUrl } from "@/lib/services/shortLink.service";
import { generateRegistrationApprovedEmailHtml, generateRegistrationRejectedEmailHtml } from "@/lib/email-templates/registration-approved";

function buildCardTargetPath(cardId: string, shareToken?: string | null) {
  const path = `/cards/${encodeURIComponent(cardId)}?share=true`;
  if (shareToken) {
    return `${path}&token=${encodeURIComponent(shareToken)}`;
  }
  return path;
}

function buildEventTargetPath(eventId: string, shortId?: string | null) {
  const slug = String(shortId || eventId).trim();
  return `/r/${encodeURIComponent(slug)}`;
}

export async function sendRegistrationApprovedEmail(input: {
  to: string;
  eventName: string;
  cardId: string;
  cardShortId?: string | null;
  shareToken?: string | null;
  eventId: string;
  eventShortId?: string | null;
}) {
  const [cardLink, eventLink] = await Promise.all([
    toPublicCompactUrl(buildCardTargetPath(input.cardId, input.shareToken)),
    toPublicCompactUrl(buildEventTargetPath(input.eventId, input.eventShortId)),
  ]);
  
  const text =
    `Your event registration for "${input.eventName}" is approved!\n\n` +
    `View your attendee card:\n${cardLink}\n\n` +
    `Event page:\n${eventLink}\n\n` +
    `We look forward to seeing you at the event.`;
  
  const html = generateRegistrationApprovedEmailHtml({
    eventName: input.eventName,
    cardLink,
    eventLink,
  });
  
  return sendTransactionalEmail({
    to: input.to,
    subject: "🎉 Your Event Registration is Approved!",
    text,
    html,
  });
}

export async function sendRegistrationRejectedEmail(input: {
  to: string;
  eventName: string;
  rejectionReason: string;
  eventId: string;
  eventShortId?: string | null;
}) {
  const eventLink = await toPublicCompactUrl(
    buildEventTargetPath(input.eventId, input.eventShortId),
  );
  
  const text =
    `Your registration for "${input.eventName}" was not approved.\n\n` +
    `Reason: ${input.rejectionReason}\n\n` +
    `Event link: ${eventLink}\n\n` +
    `You may contact the organizer if you would like to re-apply.`;
  
  const html = generateRegistrationRejectedEmailHtml({
    eventName: input.eventName,
    rejectionReason: input.rejectionReason,
    eventLink,
  });
  
  return sendTransactionalEmail({
    to: input.to,
    subject: "Registration Update for " + input.eventName,
    text,
    html,
  });
}
