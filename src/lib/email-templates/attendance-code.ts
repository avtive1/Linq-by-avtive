import {
  emailCodeDisplay,
  emailParagraph,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateVisitorAttendanceCodeEmailHtml(params: {
  eventName: string;
  attendanceCode: string;
}): string {
  return wrapAvtiveEmailLayout({
    pageTitle: "Your Attendance Code",
    headline: "Your attendance code",
    bodyHtml: `
              ${emailParagraph(`Here is your attendance code for <strong style="color:#1c1c1e;">${escapeHtml(params.eventName)}</strong>. Present it at the event entrance.`)}
              ${emailCodeDisplay("Attendance code", params.attendanceCode)}
              ${emailParagraph("Keep this email handy when you arrive.", 0)}`,
  });
}

export function appendAttendanceCodeToApprovedEmailText(text: string, attendanceCode: string): string {
  return (
    `${text}\n\n` +
    `Your attendance code: ${attendanceCode}\n` +
    `Present this code at the event entrance.`
  );
}

