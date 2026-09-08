import {
  emailAttendeeCardDisplay,
  emailParagraph,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateVisitorAttendanceCodeEmailHtml(params: {
  eventName: string;
  attendanceCode?: string;
  qrDataUrl?: string | null;
  cardLink?: string | null;
  attendeeName?: string | null;
  role?: string | null;
  company?: string | null;
}): string {
  const cardDisplayHtml = emailAttendeeCardDisplay({
    eventName: params.eventName,
    attendeeName: params.attendeeName,
    role: params.role,
    company: params.company,
    attendanceCode: params.attendanceCode,
    qrDataUrlOrCid: params.qrDataUrl,
    cardLink: params.cardLink,
  });

  return wrapAvtiveEmailLayout({
    pageTitle: "Your Event Attendee Card",
    headline: "Your event attendee card",
    greeting: params.attendeeName ? `Hi ${params.attendeeName.trim()},` : "Hi there,",
    bodyHtml: `
              ${emailParagraph(`Here is your official Attendee Card for <strong style="color:#1c1c1e;">${escapeHtml(params.eventName)}</strong>. Present this card with the scannable QR code at the event entrance for seamless check-in.`)}
              ${cardDisplayHtml}
              ${emailParagraph("Keep this email handy on your mobile device when you arrive at the venue.", 0)}`,
  });
}

export function appendAttendanceCodeToApprovedEmailText(text: string, attendanceCode: string): string {
  return (
    `${text}\n\n` +
    `Your Attendee Card with scannable QR code is included in the HTML version of this email.\n` +
    `Attendance code: ${attendanceCode}\n` +
    `Present this Attendee Card at the event entrance.`
  );
}
