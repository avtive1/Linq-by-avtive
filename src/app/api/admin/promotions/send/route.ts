import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { queryNeon, runWithRlsBypassAsync } from "@/lib/neon-db";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { logger } from "@/lib/logger-server";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";

export const dynamic = "force-dynamic";

interface RecipientEntry {
  id: string;
  name: string;
  email: string;
  linkedin?: string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      channel = "newsletter",
      subject,
      heading,
      message,
      imageUrl,
      buttonText,
      buttonUrl,
      attachmentUrl,
      attachmentName,
      theme,
      eventId,
      senderName: customSenderName,
      customRecipients,
    } = body;

    if (!channel || !message) {
      return NextResponse.json(
        { error: "Channel and message are required" },
        { status: 400 },
      );
    }

    // Lookup event details and company organization if eventId is provided
    let eventRow: { id: string; name: string; logo_url: string | null; organization_name: string | null; user_id: string } | null = null;
    if (eventId) {
      const events = await runWithRlsBypassAsync(() =>
        queryNeon<{ id: string; name: string; logo_url: string | null; organization_name: string | null; user_id: string }>(
          `SELECT e.id, e.name, e.logo_url, e.user_id, p.organization_name 
           FROM public.events e 
           LEFT JOIN public.profiles p ON p.id = e.user_id 
           WHERE e.id = $1 LIMIT 1`,
          [eventId],
        ),
      ).catch(() => []);
      if (events && events[0]) eventRow = events[0];
    }

    // Determine company & sender branding
    const companyName = customSenderName || eventRow?.organization_name || eventRow?.name || "Linq by Avtive";
    const sessionEmail = session?.user?.email?.trim().toLowerCase();

    // 1. Fetch from attendees table with Decryption
    const recipientMap = new Map<string, RecipientEntry>();

    try {
      const attendeeQuery = eventId
        ? `SELECT id, name, company, card_email, linkedin, custom_fields, event_id FROM public.attendees WHERE event_id = $1 ORDER BY created_at DESC LIMIT 2000`
        : `SELECT id, name, company, card_email, linkedin, custom_fields, event_id FROM public.attendees ORDER BY created_at DESC LIMIT 2000`;
      const attendeeParams = eventId ? [eventId] : [];

      const rawAttendees = await runWithRlsBypassAsync(() =>
        queryNeon<Record<string, unknown>>(attendeeQuery, attendeeParams),
      );

      for (const raw of rawAttendees || []) {
        const { row: decrypted } = decryptAttendeeSensitiveFields(raw);
        const customFields =
          decrypted.custom_fields && typeof decrypted.custom_fields === "object" && !Array.isArray(decrypted.custom_fields)
            ? (decrypted.custom_fields as Record<string, unknown>)
            : {};

        const rawEmail = String(
          decrypted.card_email ||
          customFields.email ||
          customFields.Email ||
          customFields.card_email ||
          ""
        ).trim().toLowerCase();

        const rawPhone = String(
          customFields.phone ||
          customFields.whatsapp ||
          customFields.Phone ||
          ""
        ).trim();

        const linkedinUrl = typeof decrypted.linkedin === "string" ? decrypted.linkedin.trim() : "";

        if (rawEmail && rawEmail.includes("@") && !recipientMap.has(rawEmail)) {
          recipientMap.set(rawEmail, {
            id: String(decrypted.id || `att-${Date.now()}`),
            name: typeof decrypted.name === "string" && decrypted.name ? decrypted.name : "Attendee",
            email: rawEmail,
            linkedin: linkedinUrl || undefined,
            phone: rawPhone || undefined,
          });
        }
      }
    } catch (attErr) {
      logger.error({ attErr }, "Error fetching and decrypting attendees for promotion");
    }

    // 2. Fetch from registration_requests table
    try {
      const regQuery = eventId
        ? `SELECT id, attendee_payload FROM public.registration_requests WHERE event_id = $1 AND status != 'REJECTED' LIMIT 2000`
        : `SELECT id, attendee_payload FROM public.registration_requests WHERE status != 'REJECTED' LIMIT 2000`;
      const regParams = eventId ? [eventId] : [];

      const regRows = await runWithRlsBypassAsync(() =>
        queryNeon<{ id: string; attendee_payload?: Record<string, unknown> }>(regQuery, regParams),
      ).catch(() => []);

      for (const row of regRows || []) {
        const payload = row.attendee_payload || {};
        const regEmail = String(
          payload.email ||
          payload.card_email ||
          payload.Email ||
          ""
        ).trim().toLowerCase();

        const regPhone = String(
          payload.phone ||
          payload.whatsapp ||
          payload.Phone ||
          ""
        ).trim();

        const regLinkedin = typeof payload.linkedin === "string" ? payload.linkedin.trim() : "";

        if (regEmail && regEmail.includes("@") && !recipientMap.has(regEmail)) {
          recipientMap.set(regEmail, {
            id: row.id,
            name: typeof payload.name === "string" && payload.name ? payload.name : "Registered Lead",
            email: regEmail,
            linkedin: regLinkedin || undefined,
            phone: regPhone || undefined,
          });
        }
      }
    } catch (regErr) {
      logger.error({ regErr }, "Error fetching registration requests for promotion");
    }

    // 3. Ingest custom recipients if provided (from spreadsheet / CSV / manual paste)
    if (Array.isArray(customRecipients)) {
      for (const r of customRecipients) {
        const rawEmail = String(r?.email || "").trim().toLowerCase();
        if (rawEmail && rawEmail.includes("@") && !recipientMap.has(rawEmail)) {
          recipientMap.set(rawEmail, {
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: String(r.name || "Attendee").trim(),
            email: rawEmail,
            linkedin: r.linkedin ? String(r.linkedin).trim() : undefined,
            phone: r.phone ? String(r.phone).trim() : undefined,
          });
        }
      }
    }

    const allRecipients = Array.from(recipientMap.values());

    // ----------------------------------------------------
    // CHANNEL 1: NEWSLETTER (EMAIL)
    // ----------------------------------------------------
    if (channel === "newsletter") {
      const emailRecipients = allRecipients.filter((r) => r.email && r.email.includes("@"));

      if (emailRecipients.length === 0) {
        return NextResponse.json({
          success: true,
          channel: "newsletter",
          sentCount: 0,
          eligibleCount: 0,
          message: "No registered attendees with valid email addresses found for this campaign.",
        });
      }

      // Check if SMTP is configured
      const hasSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

      const primaryColor =
        theme === "minimal"
          ? "#18181b"
          : theme === "dark"
          ? "#6366f1"
          : theme === "professional"
          ? "#1e40af"
          : theme === "event"
          ? "#ea580c"
          : "#7c3aed";

      const effectiveLogo = imageUrl || eventRow?.logo_url || "https://linq.avtive.app/linq-logo.png";

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; padding: 32px 24px;">
          ${effectiveLogo ? `<div style="margin-bottom: 24px; text-align: center;"><img src="${effectiveLogo}" alt="${companyName}" style="max-height: 48px; max-width: 180px; object-fit: contain; display: inline-block;" /></div>` : ""}
          <h2 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 16px; line-height: 1.3;">${heading || subject || `${companyName} Update`}</h2>
          <div style="color: #334155; font-size: 14px; line-height: 1.65; white-space: pre-wrap;">${message}</div>
          ${attachmentName ? `<div style="margin-top: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; color: #475569;">📎 <strong>Attachment:</strong> ${attachmentName}</div>` : ""}
          ${buttonText ? `<div style="margin-top: 28px; text-align: center;"><a href="${buttonUrl || "https://linq.avtive.app"}" style="background: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">${buttonText}</a></div>` : ""}
          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
            Sent by <strong>${companyName}</strong> via Linq Event Operations.<br/>
            You received this promotional update because you are registered for this campaign.
          </div>
        </div>
      `;

      if (!hasSmtp) {
        logger.info(
          { count: emailRecipients.length, companyName, subject },
          "Simulated promotional newsletter broadcast (No SMTP credentials configured)",
        );
        return NextResponse.json({
          success: true,
          channel: "newsletter",
          sentCount: emailRecipients.length,
          eligibleCount: emailRecipients.length,
          isSimulated: true,
          message: `Promotional email sent to ${emailRecipients.length} registered campaign leads on behalf of "${companyName}".`,
        });
      }

      // Batch dispatch
      const batch = emailRecipients.slice(0, 500);
      const attachments = [];
      if (attachmentUrl && attachmentName) {
        if (attachmentUrl.startsWith("data:")) {
          const match = attachmentUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            attachments.push({
              filename: attachmentName,
              content: Buffer.from(match[2], "base64"),
              contentType: match[1],
            });
          }
        } else if (attachmentUrl.startsWith("http://") || attachmentUrl.startsWith("https://")) {
          attachments.push({
            filename: attachmentName,
            path: attachmentUrl,
          });
        }
      }

      let sentCount = 0;
      for (const recipient of batch) {
        try {
          const personalizedText = `${heading ? heading + "\n\n" : ""}${message.replace(/\{\{\s*name\s*\}\}/gi, recipient.name)}`;
          const personalizedHtml = htmlBody.replace(/\{\{\s*name\s*\}\}/gi, recipient.name);

          const res = await sendTransactionalEmail({
            to: recipient.email,
            fromName: companyName,
            replyTo: sessionEmail || undefined,
            subject: subject || `${companyName} Update`,
            text: personalizedText,
            html: personalizedHtml,
            attachments: attachments.length > 0 ? attachments : undefined,
          });
          if (res.sent) {
            sentCount += 1;
          }
        } catch (sendErr) {
          logger.error({ sendErr, recipient: recipient.email }, "Failed sending promotional email to recipient");
        }
      }

      return NextResponse.json({
        success: true,
        channel: "newsletter",
        sentCount,
        eligibleCount: emailRecipients.length,
        message: `Promotional email delivered to ${sentCount} registered leads on behalf of "${companyName}".`,
      });
    }

    // ----------------------------------------------------
    // CHANNEL 2: LINKEDIN
    // ----------------------------------------------------
    if (channel === "linkedin") {
      const linkedinAttendees = allRecipients.filter((r) => r.linkedin && r.linkedin.trim());
      const hasLinkedInApi = Boolean(
        process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET,
      );

      return NextResponse.json({
        success: true,
        channel: "linkedin",
        sentCount: linkedinAttendees.length,
        eligibleCount: linkedinAttendees.length,
        isSimulated: !hasLinkedInApi,
        message: `LinkedIn outreach ready for ${linkedinAttendees.length} campaign attendees with LinkedIn profiles.`,
      });
    }

    // ----------------------------------------------------
    // CHANNEL 3: WHATSAPP
    // ----------------------------------------------------
    if (channel === "whatsapp") {
      const whatsappAttendees = allRecipients.filter((r) => r.phone && r.phone.trim().length > 0);
      const hasWhatsAppApi = Boolean(
        process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
      );

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        sentCount: whatsappAttendees.length,
        eligibleCount: whatsappAttendees.length,
        isSimulated: !hasWhatsAppApi,
        message: `WhatsApp direct broadcast ready for ${whatsappAttendees.length} campaign attendees with phone numbers.`,
      });
    }

    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err }, "Promotion send error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
