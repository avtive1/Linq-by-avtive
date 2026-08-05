import {
  emailCodeDisplay,
  emailQrCodeDisplay,
  emailParagraph,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateVisitorAttendanceCodeEmailHtml(params: {
  eventName: string;
  attendanceCode?: string;
  qrDataUrl?: string | null;
}): string {
  const displayHtml = params.qrDataUrl
    ? emailQrCodeDisplay("Attendance QR code", params.qrDataUrl)
    : params.attendanceCode
      ? emailCodeDisplay("Attendance code", params.attendanceCode)
      : "";

  return wrapAvtiveEmailLayout({
    pageTitle: "Your Attendance QR Code",
    headline: "Your attendance QR code",
    bodyHtml: `
              ${emailParagraph(`Here is your attendance QR code for <strong style="color:#1c1c1e;">${escapeHtml(params.eventName)}</strong>. Present it at the event entrance.`)}
              ${displayHtml}
              ${emailParagraph("Keep this email handy when you arrive.", 0)}`,
  });
}

export function appendAttendanceCodeToApprovedEmailText(text: string, attendanceCode: string): string {
  return (
    `${text}\n\n` +
    `Your attendance QR code is included in the HTML version of this email.\n` +
    `Attendance code: ${attendanceCode}\n` +
    `Present this QR code at the event entrance.`
  );
}
