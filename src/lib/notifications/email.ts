import nodemailer from "nodemailer";
import { logger } from "@/lib/logger-server";

type AccessRequestEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
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

  if (!user || !pass) {
    return { sent: false, error: "Email provider not configured. Please set SMTP_USER and SMTP_PASS." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: user,
        pass: pass,
      },
    });

    await transporter.sendMail({
      from: from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });

    return { sent: true };
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Email send failed");
    return { sent: false, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
