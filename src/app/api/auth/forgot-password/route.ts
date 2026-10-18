import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { forgotPasswordBodySchema } from "@/lib/validators/auth.validator";
import { requestPasswordResetCode } from "@/lib/auth/password-reset";
import { logger } from "@/lib/logger-server";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, forgotPasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();

    // Request 6-digit password reset code
    const result = await requestPasswordResetCode(normalizedEmail);

    if (!result.success) {
      if (result.error?.includes("User not registered")) {
        return NextResponse.json(
          { error: "User not registered. Please check your email or sign up." },
          { status: 404 },
        );
      }
      if (result.cooldownRemaining) {
        return NextResponse.json(
          {
            error: result.error || "Please wait before requesting another code.",
            cooldownSeconds: result.cooldownRemaining,
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: result.error || "Failed to send reset code." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        data: {
          ok: true,
          email: normalizedEmail,
          cooldownSeconds: result.cooldownRemaining || 60,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Forgot password error");
    const message = error instanceof Error ? error.message : "Failed to start password reset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
