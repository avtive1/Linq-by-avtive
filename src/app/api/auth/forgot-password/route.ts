// File location: app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { forgotPasswordBodySchema } from "@/lib/validators/auth.validator";
import { logger } from "@/lib/logger-server";

const COOLDOWN_SECONDS = 60;

/**
 * Works out the public origin of the app (used to build the link in the email).
 * Set NEXT_PUBLIC_SITE_URL in production for the most predictable result.
 */
function getOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const protocol =
    req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * POST /api/auth/forgot-password
 *
 * Asks Supabase to send the "Reset Password" email (through your configured SMTP).
 * The email contains a LINK that opens /reset-password in the browser.
 * No OTP / code is sent or typed anywhere.
 *
 * Supabase returns success for emails that do not exist, so surfacing real errors
 * (SMTP failure, rate limit) does NOT leak whether an account exists.
 */
export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, forgotPasswordBodySchema);
    if (!parsed.ok) return parsed.response;

    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      logger.error("Missing Supabase URL or key for forgot-password route");
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // IMPORTANT: no query string here. The email template appends
    // ?token_hash=...&type=recovery to this URL.
    // This exact URL must be in Supabase -> Auth -> URL Configuration -> Redirect URLs.
    const redirectTo = `${getOrigin(req)}/reset-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (resetError) {
      logger.error(
        { err: resetError, status: resetError.status, email: normalizedEmail },
        "Supabase resetPasswordForEmail failed",
      );

      if (resetError.status === 429 || /rate limit|security purposes/i.test(resetError.message)) {
        return NextResponse.json(
          {
            error: "Too many requests. Please wait a minute and try again.",
            data: { cooldownSeconds: COOLDOWN_SECONDS },
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        { error: "We couldn't send the reset email right now. Please try again shortly." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: { ok: true, cooldownSeconds: COOLDOWN_SECONDS } },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Forgot password error");
    return NextResponse.json(
      { error: "Failed to start password reset. Please try again." },
      { status: 500 },
    );
  }
}