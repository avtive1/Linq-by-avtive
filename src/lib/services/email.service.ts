import QRCode from "qrcode";
import { enqueueBrandedTransactionalEmail, type EmailAttachmentPayload } from "@/lib/notifications/email-outbox";
import { toPublicCompactUrl } from "@/lib/services/shortLink.service";
import {
  appendAttendanceCodeToApprovedEmailText,
  generateVisitorAttendanceCodeEmailHtml,
} from "@/lib/email-templates/attendance-code";
import {
  generateRegistrationApprovedEmailHtml,
  generateRegistrationRejectedEmailHtml,
} from "@/lib/email-templates/registration-approved";
import { generateAttendanceQrDataUrl } from "@/lib/security/attendance-qr";
import { escapeHtml, emailParagraph, wrapAvtiveEmailLayout, ATTENDANCE_QR_CID } from "@/lib/email-templates/layout";

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
  attendanceCode?: string | null;
  attendeeName?: string | null;
  role?: string | null;
  company?: string | null;
}) {
  const [cardLink, eventLink] = await Promise.all([
    toPublicCompactUrl(buildCardTargetPath(input.cardId, input.shareToken)),
    toPublicCompactUrl(buildEventTargetPath(input.eventId, input.eventShortId)),
  ]);

  const attendanceCode = String(input.attendanceCode || "").trim();

  let qrDataUrl: string | null = null;
  const attachments: EmailAttachmentPayload[] = [];

  if (attendanceCode && input.cardId && input.eventId) {
    try {
      qrDataUrl = await generateAttendanceQrDataUrl({
        attendeeId: input.cardId,
        eventId: input.eventId,
        code: attendanceCode,
      });

      if (qrDataUrl) {
        const base64Content = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        attachments.push({
          filename: "attendance-qr.png",
          content: base64Content,
          cid: ATTENDANCE_QR_CID,
          contentType: "image/png",
          contentDisposition: "inline",
        });
      }
    } catch {
      qrDataUrl = null;
    }
  }

  // Fallback to card link QR code if attendance code was not generated
  if (!qrDataUrl && (input.cardId || cardLink)) {
    try {
      const targetUrl = cardLink || `${process.env.NEXT_PUBLIC_APP_URL || "https://linq.avtive.app"}/cards/${input.cardId}?share=true`;
      qrDataUrl = await QRCode.toDataURL(targetUrl, {
        margin: 1,
        width: 280,
        color: { dark: "#1c1c1e", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      if (qrDataUrl) {
        const base64Content = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        attachments.push({
          filename: "attendance-qr.png",
          content: base64Content,
          cid: ATTENDANCE_QR_CID,
          contentType: "image/png",
          contentDisposition: "inline",
        });
      }
    } catch {
      qrDataUrl = null;
    }
  }

  const attendeeGreeting = input.attendeeName?.trim() ? `Hi ${input.attendeeName.trim()}` : "Hi there";

  let text =
    `${attendeeGreeting},\n\n` +
    `Your event registration for "${input.eventName}" is approved!\n\n` +
    `View your attendee card:\n${cardLink}\n\n` +
    `Event page:\n${eventLink}\n\n` +
    `We look forward to seeing you at the event.`;

  if (attendanceCode) {
    text = appendAttendanceCodeToApprovedEmailText(text, attendanceCode);
  }

  const html = generateRegistrationApprovedEmailHtml({
    eventName: input.eventName,
    cardLink,
    eventLink,
    attendanceCode,
    qrDataUrl: qrDataUrl ? `cid:${ATTENDANCE_QR_CID}` : null,
    attendeeName: input.attendeeName,
    role: input.role,
    company: input.company,
  });

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: "Your Event Registration is Approved",
    text,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

export async function sendVisitorAttendanceCodeEmail(input: {
  to: string;
  eventName: string;
  attendanceCode: string;
  attendeeId?: string;
  eventId?: string;
  cardId?: string;
  shareToken?: string | null;
  attendeeName?: string | null;
  role?: string | null;
  company?: string | null;
}) {
  const cardId = String(input.cardId || input.attendeeId || "").trim();
  const cardLink = cardId
    ? await toPublicCompactUrl(buildCardTargetPath(cardId, input.shareToken))
    : null;

  let qrDataUrl: string | null = null;
  const attachments: EmailAttachmentPayload[] = [];

  if (input.attendanceCode && cardId && input.eventId) {
    try {
      qrDataUrl = await generateAttendanceQrDataUrl({
        attendeeId: cardId,
        eventId: input.eventId,
        code: input.attendanceCode,
      });

      if (qrDataUrl) {
        const base64Content = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        attachments.push({
          filename: "attendance-qr.png",
          content: base64Content,
          cid: ATTENDANCE_QR_CID,
          contentType: "image/png",
          contentDisposition: "inline",
        });
      }
    } catch {
      qrDataUrl = null;
    }
  }

  // Fallback to card link QR code if attendance code was not generated
  if (!qrDataUrl && (cardId || cardLink)) {
    try {
      const targetUrl = cardLink || `${process.env.NEXT_PUBLIC_APP_URL || "https://linq.avtive.app"}/cards/${cardId}?share=true`;
      qrDataUrl = await QRCode.toDataURL(targetUrl, {
        margin: 1,
        width: 280,
        color: { dark: "#1c1c1e", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      if (qrDataUrl) {
        const base64Content = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        attachments.push({
          filename: "attendance-qr.png",
          content: base64Content,
          cid: ATTENDANCE_QR_CID,
          contentType: "image/png",
          contentDisposition: "inline",
        });
      }
    } catch {
      qrDataUrl = null;
    }
  }

  const attendeeGreeting = input.attendeeName?.trim() ? `Hi ${input.attendeeName.trim()}` : "Hi there";

  let text =
    `${attendeeGreeting},\n\n` +
    `Your official Attendee Card for "${input.eventName}" is ready!\n\n`;

  if (cardLink) {
    text += `View your digital Attendee Card:\n${cardLink}\n\n`;
  }

  text +=
    `Attendance code: ${input.attendanceCode}\n\n` +
    `Your Attendee Card with scannable attendance QR code is included in the HTML version of this email.\n` +
    `Present this card at the event entrance for seamless check-in.`;

  const html = generateVisitorAttendanceCodeEmailHtml({
    eventName: input.eventName,
    attendanceCode: input.attendanceCode,
    qrDataUrl: qrDataUrl ? `cid:${ATTENDANCE_QR_CID}` : null,
    cardLink,
    attendeeName: input.attendeeName,
    role: input.role,
    company: input.company,
  });

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: `Your Attendee Card for ${input.eventName}`,
    text,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
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
    `Hi there,\n\n` +
    `Your event registration for "${input.eventName}" was not approved.\n\n` +
    `Reason:\n${input.rejectionReason}\n\n` +
    `Event page:\n${eventLink}`;

  const html = generateRegistrationRejectedEmailHtml({
    eventName: input.eventName,
    rejectionReason: input.rejectionReason,
    eventLink,
  });

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: "Update on Your Event Registration",
    text,
    html,
  });
}

export async function sendCustomAttendeeEmail(input: {
  to: string;
  subject: string;
  body: string;
}) {
  const bodyHtml = input.body
    .split(/\n{2,}/)
    .map((para) => emailParagraph(escapeHtml(para).replace(/\n/g, "<br />")))
    .join("");

  const html = wrapAvtiveEmailLayout({
    pageTitle: input.subject,
    headline: input.subject,
    bodyHtml,
  });

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text: input.body,
    html,
  });
}
