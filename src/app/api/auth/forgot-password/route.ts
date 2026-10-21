import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { forgotPasswordBodySchema } from "@/lib/validators/auth.validator";
import { logger } from "@/lib/logger-server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/forgot-password
 *
 * Sends a Supabase password-recovery email using the **service-role** key
 * on the server side. This mirrors the exact behaviour you see when clicking
 * "Send recovery link" in the Supabase Dashboard → Auth → Users table.
 *
 * The email contains a magic link that redirects the user to /auth/callback
 * which exchanges the PKCE code for a session and then forwards to /reset-password.
 *
 * Always returns 200 to avoid leaking whether an email is registered.
 */
export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, forgotPasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "";

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for password reset");
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 },
      );
    }

    // Create a one-off Supabase client with the service-role key.
    // Using the service-role key is what makes this work identically to the
    // Supabase Dashboard "Send recovery email" feature.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Determine the app origin from request headers (works in both dev & prod)
    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const protocol =
      req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const origin = `${protocol}://${host}`;

    // resetPasswordForEmail with the service-role key triggers Supabase's
    // built-in email delivery (same SMTP / email template configured in the
    // Supabase Dashboard under Authentication → Email Templates).
    //
    // The redirectTo must be listed in Authentication → URL Configuration →
    // Redirect URLs on the Supabase Dashboard.
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      },
    );

    if (resetError) {
      // Log it but still return 200 to avoid leaking whether the email exists
      logger.warn(
        { err: resetError, email: normalizedEmail },
        "Supabase resetPasswordForEmail failed — returning silent 200",
      );
    }

    // Always return success to avoid email enumeration attacks
    return NextResponse.json(
      {
        data: {
          ok: true,
          email: normalizedEmail,
          cooldownSeconds: 60,
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
