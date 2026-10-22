// File location: app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger-server";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

/**
 * POST /api/auth/reset-password
 *
 * Link-based flow only (no OTP/token-in-body flow any more).
 *
 * The browser opens the emailed link, verifies it (Supabase creates a recovery session),
 * then calls this route with:
 *   Authorization: Bearer <recovery session access token>
 *   body: { password }
 *
 * This route is the single place that changes the password:
 *   1. verifies the access token
 *   2. enforces the password policy
 *   3. updates the password in Supabase Auth
 *   4. syncs the Argon2 hash to public.auth_users
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";

    const authHeader = req.headers.get("authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!accessToken) {
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

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      logger.error("Missing Supabase URL or service key for reset-password route");
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verify the recovery session token the browser sent
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(accessToken);

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { error: "Invalid or expired reset session. Please request a new reset link." },
        { status: 401 },
      );
    }

    // 2. Update the password in Supabase Auth
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (updateError) {
      logger.warn({ err: updateError, userId: user.id }, "Supabase password update failed");
      return NextResponse.json(
        { error: updateError.message || "Could not update password." },
        { status: 400 },
      );
    }

    // 3. Sync the Argon2 hash in public.auth_users
    try {
      const { updateUserPasswordDirectly } = await import("@/lib/auth-db");
      await updateUserPasswordDirectly(user.email, password);
    } catch (syncError) {
      logger.error(
        { err: syncError instanceof Error ? syncError : undefined, userId: user.id },
        "auth_users password sync failed after Supabase update",
      );
      return NextResponse.json(
        { error: "Password updated, but account sync failed. Please contact support." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: { ok: true, message: "Password updated successfully." } },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Reset password error");
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 },
    );
  }
}