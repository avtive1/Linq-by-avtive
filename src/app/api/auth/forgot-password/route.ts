import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth-db";
import { sendTransactionalEmail } from "@/lib/notifications/email";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const token = await createPasswordResetToken(email);
    if (token) {
      const url = new URL(req.url);
      const resetUrl = `${url.origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendTransactionalEmail({
        to: email,
        subject: "Reset your AVTIVE password",
        text: `Reset your password using this link:\n\n${resetUrl}\n\nThis link expires in 30 minutes.`,
      }).catch(() => null);
    }
    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start password reset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
