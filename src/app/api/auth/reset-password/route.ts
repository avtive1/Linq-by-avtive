import { NextResponse } from "next/server";
import { completePasswordReset } from "@/lib/auth/password-reset";
import { logger } from "@/lib/logger-server";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { z } from "zod";

const resetWithTokenSchema = z.object({
  token: z.string().trim().min(16, "Invalid reset token.").max(256),
  password: z.string().min(12, "Password must be at least 12 characters.").max(128),
});

export async function POST(req: Request) {
  try {
    // Read the body once — do NOT call req.json() or parseJsonBody a second time
    const rawBody = await req.json().catch(() => ({}));
    const token = typeof rawBody?.token === "string" ? rawBody.token.trim() : undefined;
    const password = typeof rawBody?.password === "string" ? rawBody.password : "";

    // 1. Token-based reset (from custom OTP verify-reset-code flow)
    if (token) {
      const validated = resetWithTokenSchema.safeParse({ token, password });
      if (!validated.success) {
        const first = validated.error.issues[0]?.message || "Validation failed.";
        return NextResponse.json({ error: first }, { status: 400 });
      }

      const policyIssues = validatePasswordPolicy(validated.data.password);
      if (policyIssues.length > 0) {
        return NextResponse.json({ error: policyIssues[0] }, { status: 400 });
      }

      const result = await completePasswordReset(validated.data.token, validated.data.password);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to reset password." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { data: { ok: true, message: "Password updated successfully." } },
        { status: 200 },
      );
    }

    // 2. Supabase session-based reset (from Supabase magic-link recovery flow)
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { error: "Invalid or expired reset session. Please request a new reset link." },
        { status: 401 },
      );
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const policyIssues = validatePasswordPolicy(password);
    if (policyIssues.length > 0) {
      return NextResponse.json({ error: policyIssues[0] }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Sync Argon2 hash in public.auth_users
    const { updateUserPasswordDirectly } = await import("@/lib/auth-db");
    await updateUserPasswordDirectly(user.email, password);

    return NextResponse.json(
      { data: { ok: true, message: "Password updated successfully." } },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Reset password error");
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
