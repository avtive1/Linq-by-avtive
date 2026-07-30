import { NextResponse } from "next/server";
import { neonAuth } from "@/auth";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { resetPasswordBodySchema } from "@/lib/validators/auth.validator";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, resetPasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { token, password } = parsed.data;

    const issues = validatePasswordPolicy(password);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues[0] }, { status: 400 });
    }

    const result = await neonAuth.resetPassword({
      token,
      newPassword: password,
    } as Parameters<typeof neonAuth.resetPassword>[0]);
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Invalid or expired reset token." },
        { status: result.error.status || 400 },
      );
    }
    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
