import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth-db";
import {
  createAndEmailLoginOtp,
  isOrganizationAccountUser,
  isOrgLoginEmailOtpGloballyEnabled,
} from "@/lib/auth-login-otp";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { loginOtpRequestBodySchema } from "@/lib/validators/auth.validator";
import { isTransientDbError } from "@/lib/neon-db";

export async function POST(req: Request) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) {
      return NextResponse.json(
        { error: csrf.reason || "CSRF validation failed." },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBody(req, loginOtpRequestBodySchema);
    if (!parsed.ok) return parsed.response;

    const { email, password } = parsed.data;
    const user = await verifyPassword(email, password);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const needsOtp =
      isOrgLoginEmailOtpGloballyEnabled() &&
      (await isOrganizationAccountUser(user.user_id));

    if (!needsOtp) {
      return NextResponse.json({ needsOtp: false }, { status: 200 });
    }

    const sent = await createAndEmailLoginOtp(user.user_id, user.email);

    if (!sent.ok) {
      return NextResponse.json(
        { error: sent.error || "Could not send verification email." },
        { status: 503 }
      );
    }

    return NextResponse.json({ needsOtp: true }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Login verification failed.";
    console.error("Login OTP request failed:", message);
    if (isTransientDbError(error)) {
      return NextResponse.json(
        { error: "Database connection failed. Please try again." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}