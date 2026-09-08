import {
  emailAttendeeCardDisplay,
  emailHighlightBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  emailSecondaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateRegistrationApprovedEmailHtml(params: {
  eventName: string;
  cardLink: string;
  eventLink: string;
  attendanceCode?: string | null;
  qrDataUrl?: string | null;
  attendeeName?: string | null;
  role?: string | null;
  company?: string | null;
}): string {
  const eventName = escapeHtml(params.eventName);
  const attendanceCode = String(params.attendanceCode || "").trim();

  const cardHtml = emailAttendeeCardDisplay({
    eventName: params.eventName,
    attendeeName: params.attendeeName,
    role: params.role,
    company: params.company,
    attendanceCode,
    qrDataUrlOrCid: params.qrDataUrl,
    cardLink: params.cardLink,
  });

  return wrapAvtiveEmailLayout({
    pageTitle: "Registration Approved",
    headline: "Registration approved",
    greeting: params.attendeeName ? `Hi ${params.attendeeName.trim()},` : "Hi there,",
    bodyHtml: `
              ${emailHighlightBox(`<strong>Great news!</strong> Your registration for <strong>${eventName}</strong> has been approved.`, "success")}
              ${emailParagraph("You're all set for the event. Here is your official Attendee Card with scannable check-in QR code:")}
              ${cardHtml}
              ${emailSecondaryButton("View Event Page", params.eventLink)}`,
  });
}

export function generateRegistrationRejectedEmailHtml(params: {
  eventName: string;
  rejectionReason: string;
  eventLink: string;
}): string {
  const eventName = escapeHtml(params.eventName);

  return wrapAvtiveEmailLayout({
    pageTitle: "Registration Update",
    headline: "Registration update",
    bodyHtml: `
              ${emailParagraph(`Your registration for <strong style="color:#1c1c1e;">${eventName}</strong> was not approved at this time.`)}
              ${emailHighlightBox(`<strong>Reason:</strong> ${escapeHtml(params.rejectionReason)}`, "warning")}
              ${emailParagraph("You may contact the organizer if you believe this is a mistake, or reapply if eligibility changes.")}
              ${emailPrimaryButton("View Event Page", params.eventLink)}
              ${emailLinkFallback(params.eventLink)}`,
  });
}
