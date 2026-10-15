import { NextResponse } from "next/server";
import { neonAuth } from "@/auth";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { forgotPasswordBodySchema } from "@/lib/validators/auth.validator";
import { getPublicAppUrl } from "@/lib/app-url";
import { createPasswordResetToken } from "@/lib/auth-db";
import { generatePasswordResetEmailHtml } from "@/lib/email-templates/account-emails";
import { enqueueBrandedTransactionalEmail } from "@/lib/notifications/email-outbox";
import { sendBrandedTransactionalEmail } from "@/lib/notifications/branded-email";
import { logger } from "@/lib/logger-server";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, forgotPasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();
    const base = getPublicAppUrl(req);

    // 1. Generate password reset token if the user is registered
    const token = await createPasswordResetToken(normalizedEmail);

    if (token) {
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
      const bodyText =
        `Hi,\n\n` +
        `We received a request to reset your password for your Linq account.\n\n` +
        `Click the link below to choose a new password:\n` +
        `${resetUrl}\n\n` +
        `This link will expire in 30 minutes. If you did not request a password reset, you can safely ignore this email.\n`;

      const emailHtml = generatePasswordResetEmailHtml({ resetUrl });

      const queueResult = await enqueueBrandedTransactionalEmail({
        to: normalizedEmail,
        subject: "Reset your password - Linq",
        text: bodyText,
        html: emailHtml,
      });

      if (!queueResult.queued) {
        await sendBrandedTransactionalEmail({
          to: normalizedEmail,
          subject: "Reset your password - Linq",
          text: bodyText,
          html: emailHtml,
        }).catch((err) => {
          logger.error({ err }, "Direct reset email sending failed");
        });
      }
    }

    // 2. Best-effort sync with Neon Auth if configured
    try {
      await (neonAuth as any).requestPasswordReset?.({
        email: normalizedEmail,
        redirectTo: `${base}/reset-password`,
      });
    } catch {
      // Best-effort
    }

    // Return 200 with standard response so account existence is not enumerated
    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Forgot password error");
    const message = error instanceof Error ? error.message : "Failed to start password reset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
