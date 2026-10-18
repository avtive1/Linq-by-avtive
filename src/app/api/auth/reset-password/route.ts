import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { resetPasswordBodySchema } from "@/lib/validators/auth.validator";
import { completePasswordReset } from "@/lib/auth/password-reset";
import { logger } from "@/lib/logger-server";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, resetPasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { token, password } = parsed.data;

    const result = await completePasswordReset(token, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to reset password." },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: { ok: true, message: "Password updated successfully." } }, { status: 200 });
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Reset password error");
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
