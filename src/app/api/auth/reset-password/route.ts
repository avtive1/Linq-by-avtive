import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { resetPasswordBodySchema } from "@/lib/validators/auth.validator";
import { completePasswordReset } from "@/lib/auth/password-reset";
import { logger } from "@/lib/logger-server";

export async function POST(req: Request) {
  try {
    const rawBody = await req.clone().json().catch(() => ({}));
    const password = String(rawBody?.password || "");
    const token = typeof rawBody?.token === "string" ? rawBody.token : undefined;

    // 1. If reset token provided (e.g. from code verification or API testing), use completePasswordReset
    if (token) {
      const parsed = await parseJsonBody(req, resetPasswordBodySchema);
      if (!parsed.ok) return parsed.response;

      const result = await completePasswordReset(token, password);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to reset password." },
          { status: 400 },
        );
      }
      return NextResponse.json({ data: { ok: true, message: "Password updated successfully." } }, { status: 200 });
    }

    // 2. Otherwise, check for active Supabase recovery session
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { error: "Invalid or expired reset session. Please request a new reset link." },
        { status: 401 },
      );
    }

    const { validatePasswordPolicy } = await import("@/lib/security/password-policy");
    const issues = validatePasswordPolicy(password);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues[0] }, { status: 400 });
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Sync Argon2 hash in public.auth_users database table
    const { updateUserPasswordDirectly } = await import("@/lib/auth-db");
    await updateUserPasswordDirectly(user.email, password);

    return NextResponse.json({ data: { ok: true, message: "Password updated successfully." } }, { status: 200 });
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Reset password error");
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
