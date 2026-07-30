import { NextResponse } from "next/server";
import { neonAuth } from "@/auth";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
    }

    const issues = validatePasswordPolicy(newPassword);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues[0] }, { status: 400 });
    }

    const result = await neonAuth.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    } as Parameters<typeof neonAuth.changePassword>[0]);
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Failed to change password." },
        { status: result.error.status || 400 },
      );
    }

    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
