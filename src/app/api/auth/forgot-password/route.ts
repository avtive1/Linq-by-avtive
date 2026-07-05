import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth-db";
import { sendBrandedTransactionalEmail } from "@/lib/notifications/branded-email";
import { generatePasswordResetEmailHtml } from "@/lib/email-templates/account-emails";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { forgotPasswordBodySchema } from "@/lib/validators/auth.validator";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, forgotPasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    const token = await createPasswordResetToken(email);
    if (token) {
      const url = new URL(req.url);
      const resetUrl = `${url.origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendBrandedTransactionalEmail({
        to: email,
        subject: "Reset your AVTIVE password",
        text:
          `Hi there,\n\n` +
          `Reset your password using this link:\n\n${resetUrl}\n\n` +
          `This link expires in 30 minutes.`,
        html: generatePasswordResetEmailHtml({ resetUrl }),
      }).catch(() => null);
    }
    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start password reset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
