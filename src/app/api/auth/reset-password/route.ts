import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth-db";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required." }, { status: 400 });
    }

    const issues = validatePasswordPolicy(password);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues[0] }, { status: 400 });
    }

    const ok = await resetPasswordWithToken(token, password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
    }
    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
