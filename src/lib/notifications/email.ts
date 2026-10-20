import nodemailer from "nodemailer";
import { logger } from "@/lib/logger-server";

type AccessRequestEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
  messageId?: string;
  fromName?: string;
  from?: string;
  replyTo?: string;
};

type SendEmailResult = {
  sent: boolean;
  error?: string;
};

/**
 * Sends email via Nodemailer (Gmail) when configured.
 * This is intentionally best-effort so product flows never break if email provider is unavailable.
 */
export async function sendTransactionalEmail(input: AccessRequestEmailInput): Promise<SendEmailResult> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const rawFrom = input.from || process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@avtive.app";
  const fromName = input.fromName || process.env.EMAIL_FROM_NAME || "AVTIVE";
  const replyTo = input.replyTo || process.env.EMAIL_REPLY_TO || rawFrom;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || "587");

  // Ensure from header is RFC 5322 formatted (e.g. "Acme Corp <hello@avtive.app>")
  const formattedFrom = rawFrom.includes("<")
    ? rawFrom
    : `"${fromName.replace(/"/g, "")}" <${rawFrom.trim()}>`;

  // 1. Primary path: Use Resend API if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: formattedFrom,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
          reply_to: replyTo,
        }),
      });

      if (res.ok) {
        return { sent: true };
      }
      const errJson = await res.json().catch(() => ({}));
      logger.warn({ errJson }, "Resend API call failed, falling back to SMTP transport if available");
    } catch (err) {
      logger.warn({ err }, "Resend API call error, falling back to SMTP transport if available");
    }
  }

  if (!user || !pass) {
    return { sent: false, error: "Email provider not configured. Please set RESEND_API_KEY or SMTP_USER and SMTP_PASS." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure: port === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      tls: { minVersion: "TLSv1.2" },
      auth: {
        user: user,
        pass: pass,
      },
    });

    const inlineAttachments = input.attachments?.map((attachment) => {
      if (!attachment || typeof attachment !== "object" || !("cid" in attachment) || !attachment.cid) {
        return attachment;
      }
      return {
        ...attachment,
        contentDisposition: "inline" as const,
      };
    });

    await transporter.sendMail({
      from: formattedFrom,
      replyTo: replyTo,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: inlineAttachments,
      messageId: input.messageId,
      headers: {
        "X-Entity-Ref-ID": input.messageId || `${Date.now()}`,
        "List-Unsubscribe": `<mailto:${rawFrom.replace(/.*<([^>]+)>.*/, "$1").trim()}?subject=unsubscribe>`,
        "Auto-Submitted": "auto-generated",
      },
    });

    return { sent: true };
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Email send failed");
    return { sent: false, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
