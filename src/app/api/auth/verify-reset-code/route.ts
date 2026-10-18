import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { verifyResetCodeBodySchema } from "@/lib/validators/auth.validator";
import { verifyPasswordResetCode } from "@/lib/auth/password-reset";
import { logger } from "@/lib/logger-server";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, verifyResetCodeBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email, code } = parsed.data;

    const result = await verifyPasswordResetCode(email, code);

    if (!result.success) {
      const isRateLimited = result.error?.toLowerCase().includes("too many failed attempts");
      return NextResponse.json(
        { error: result.error || "Invalid or expired verification code." },
        { status: isRateLimited ? 429 : 400 },
      );
    }

    return NextResponse.json(
      {
        data: {
          ok: true,
          resetToken: result.resetToken,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Verify reset code error");
    const message = error instanceof Error ? error.message : "Failed to verify reset code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
