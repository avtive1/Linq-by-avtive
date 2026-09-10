import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { queryNeon } from "@/lib/neon-db";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { logger } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

interface AttendeeRow {
  id: string;
  name: string | null;
  card_email: string | null;
  linkedin: string | null;
  custom_fields: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify Admin permission
    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const sessionEmail = session?.user?.email?.trim().toLowerCase();
    const role = String(session?.user?.role || "");
    const isAdminByRole = typeof role === "string" && role.toLowerCase() === "admin";
    const isAdminByEmail = Boolean(sessionEmail && adminEmails.includes(sessionEmail));

    let isOrgAdmin = false;
    if (userId) {
      try {
        const eventRow = await queryNeon<{ count: string | number }>(
          `SELECT COUNT(*)::int AS count FROM public.events WHERE user_id = $1`,
          [userId],
        );
        if (Number(eventRow[0]?.count || 0) > 0) {
          isOrgAdmin = true;
        }
      } catch {
        // Fallback
      }
    }

    if (!isAdminByRole && !isAdminByEmail && !isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      channel,
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
    } = body;

    if (!channel || !message) {
      return NextResponse.json(
        { error: "Channel and message are required" },
        { status: 400 },
      );
    }

    // Fetch attendees from public.attendees (isolated by eventId if specified)
    let rows: AttendeeRow[] = [];
    try {
      if (eventId) {
        rows = await queryNeon<AttendeeRow>(
          `SELECT id, name, card_email, linkedin, custom_fields 
           FROM public.attendees 
           WHERE event_id = $1
           ORDER BY created_at DESC 
           LIMIT 1000`,
          [eventId],
        );
      } else {
        rows = await queryNeon<AttendeeRow>(
          `SELECT id, name, card_email, linkedin, custom_fields 
           FROM public.attendees 
           ORDER BY created_at DESC 
           LIMIT 1000`,
        );
      }
    } catch (dbErr) {
      logger.error({ dbErr }, "Failed to fetch attendees for promotion");
      return NextResponse.json(
        { error: "Database error retrieving attendees" },
        { status: 500 },
      );
    }

    // 1. Channel: NEWSLETTER
    if (channel === "newsletter") {
      const emailRecipients = rows
        .map((r) => {
          const email =
            r.card_email ||
            (r.custom_fields && typeof r.custom_fields === "object"
              ? String(r.custom_fields.email || r.custom_fields.Email || "")
              : "");
          return {
            id: r.id,
            name: r.name || "Attendee",
            email: email.trim(),
          };
        })
        .filter((r) => r.email && r.email.includes("@"));

      if (emailRecipients.length === 0) {
        return NextResponse.json({
          success: true,
          channel: "newsletter",
          sentCount: 0,
          eligibleCount: 0,
          message: "No attendees with valid email addresses found.",
        });
      }

      // Check if SMTP is configured
      const hasSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
      if (!hasSmtp) {
        return NextResponse.json({
          success: false,
          channel: "newsletter",
          sentCount: 0,
          eligibleCount: emailRecipients.length,
          error:
            "Email service not configured. Please set SMTP_USER and SMTP_PASS in environment variables.",
        });
      }

      let sentCount = 0;
      const primaryColor = theme === "minimal" ? "#18181b" : theme === "dark" ? "#6366f1" : theme === "professional" ? "#1e40af" : theme === "event" ? "#ea580c" : "#5B4DFB";
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; padding: 24px;">
          ${imageUrl ? `<div style="margin-bottom: 20px; border-radius: 8px; overflow: hidden;"><img src="${imageUrl}" alt="" style="width: 100%; height: auto; display: block;" /></div>` : ""}
          <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0;">${heading || subject || "Linq Event Update"}</h2>
          <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
          ${attachmentName ? `<div style="margin-top: 16px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #475569;">📎 Attachment: ${attachmentName}</div>` : ""}
          ${buttonText ? `<div style="margin-top: 24px;"><a href="${buttonUrl || "https://linq.avtive.com"}" style="background: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block;">${buttonText}</a></div>` : ""}
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
            Sent by Linq Event Operations.
          </div>
        </div>
      `;

      // Dispatch to recipients (up to batch limit)
      const batch = emailRecipients.slice(0, 100);
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

      for (const recipient of batch) {
        try {
          const res = await sendTransactionalEmail({
            to: recipient.email,
            subject: subject || "Linq Event Newsletter",
            text: `${heading ? heading + "\n\n" : ""}${message}`,
            html: htmlBody,
            attachments: attachments.length > 0 ? attachments : undefined,
          });
          if (res.sent) {
            sentCount += 1;
          }
        } catch {
          // Log individual error and continue
        }
      }

      return NextResponse.json({
        success: true,
        channel: "newsletter",
        sentCount,
        eligibleCount: emailRecipients.length,
        message: `Newsletter delivered to ${sentCount} attendee${sentCount === 1 ? "" : "s"}`,
      });
    }

    // 2. Channel: LINKEDIN
    if (channel === "linkedin") {
      const linkedinAttendees = rows.filter((r) => r.linkedin && r.linkedin.trim());
      // Check if LinkedIn Messaging API is configured
      const hasLinkedInApi = Boolean(
        process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET,
      );

      if (!hasLinkedInApi) {
        return NextResponse.json({
          success: false,
          channel: "linkedin",
          sentCount: 0,
          eligibleCount: linkedinAttendees.length,
          error:
            "LinkedIn Messaging API is not configured. Direct automated DM dispatch requires LinkedIn API credentials.",
        });
      }

      return NextResponse.json({
        success: true,
        channel: "linkedin",
        sentCount: 0,
        eligibleCount: linkedinAttendees.length,
        message: `Found ${linkedinAttendees.length} attendees with LinkedIn profiles.`,
      });
    }

    // 3. Channel: WHATSAPP
    if (channel === "whatsapp") {
      const whatsappAttendees = rows.filter((r) => {
        const phone =
          r.custom_fields && typeof r.custom_fields === "object"
            ? String(r.custom_fields.phone || r.custom_fields.whatsapp || "")
            : "";
        return phone.trim().length > 0;
      });

      // Check if WhatsApp Business API is configured
      const hasWhatsAppApi = Boolean(
        process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
      );

      if (!hasWhatsAppApi) {
        return NextResponse.json({
          success: false,
          channel: "whatsapp",
          sentCount: 0,
          eligibleCount: whatsappAttendees.length,
          error:
            "WhatsApp Business API is not configured. Direct messaging requires WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
        });
      }

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        sentCount: 0,
        eligibleCount: whatsappAttendees.length,
        message: `Found ${whatsappAttendees.length} attendees with phone numbers.`,
      });
    }

    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err }, "Promotion send error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
