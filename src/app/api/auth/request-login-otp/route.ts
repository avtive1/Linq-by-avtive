import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth-db";
import {
  createAndEmailLoginOtp,
  isOrganizationAccountUser,
  isOrgLoginEmailOtpGloballyEnabled,
} from "@/lib/auth-login-otp";
import { validateCsrfOrigin } from "@/lib/security/csrf";

export async function POST(req: Request) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const body = (await req.json()) as { email?: string; password?: string };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await verifyPassword(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const needsOtp = isOrgLoginEmailOtpGloballyEnabled() && (await isOrganizationAccountUser(user.user_id));
    if (!needsOtp) {
      return NextResponse.json({ needsOtp: false }, { status: 200 });
    }

    const sent = await createAndEmailLoginOtp(user.user_id, user.email);
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error || "Could not send verification email." }, { status: 503 });
    }

    return NextResponse.json({ needsOtp: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
