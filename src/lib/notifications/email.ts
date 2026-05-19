import nodemailer from "nodemailer";

type AccessRequestEmailInput = {
  to: string;
  subject: string;
  text: string;
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

    const info = await transporter.sendMail({
      from: from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    return { sent: true };
  } catch (error) {
    console.error("Email send failed:", error);
    return { sent: false, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
