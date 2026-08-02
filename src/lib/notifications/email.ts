import nodemailer from "nodemailer";
import { logger } from "@/lib/logger-server";

type AccessRequestEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
  messageId?: string;
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
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@avtive.app";
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || "587");

  if (!user || !pass) {
    return { sent: false, error: "Email provider not configured. Please set SMTP_USER and SMTP_PASS." };
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
      from: from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: inlineAttachments,
      messageId: input.messageId,
    });

    return { sent: true };
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Email send failed");
    return { sent: false, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
