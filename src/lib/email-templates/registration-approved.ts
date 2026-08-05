import {
  emailCodeDisplay,
  emailQrCodeDisplay,
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
}): string {
  const eventName = escapeHtml(params.eventName);
  const attendanceCode = String(params.attendanceCode || "").trim();

  const attendanceHtml = params.qrDataUrl
    ? emailQrCodeDisplay("Your attendance QR code", params.qrDataUrl)
    : attendanceCode
      ? emailCodeDisplay("Your attendance code", attendanceCode)
      : "";

  return wrapAvtiveEmailLayout({
    pageTitle: "Registration Approved",
    headline: "Registration approved",
    bodyHtml: `
              ${emailHighlightBox(`<strong>Great news!</strong> Your registration for <strong>${eventName}</strong> has been approved.`, "success")}
              ${emailParagraph("You're all set for the event. Use the links below to view your attendee card and event page.")}
              ${attendanceHtml}
              ${emailPrimaryButton("View Attendee Card", params.cardLink)}
              ${emailSecondaryButton("View Event Page", params.eventLink)}
              ${emailLinkFallback(params.cardLink)}`,
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
