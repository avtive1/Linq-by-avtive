import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { queryNeonOne, queryNeon } from "@/lib/neon-db";
import argon2 from "argon2";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's password hash
    const authUser = await queryNeonOne<{ user_id: string; password_hash: string }>(
      `SELECT user_id, password_hash
       FROM public.auth_users
       WHERE user_id = $1`,
      [userId]
    );

    if (!authUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Verify current password
    const isCurrentValid = await argon2.verify(authUser.password_hash, currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json({ error: "Incorrect current password." }, { status: 400 });
    }

    // Validate new password policy
    const issues = validatePasswordPolicy(newPassword);
    if (issues.length > 0) {
      return NextResponse.json({ error: issues[0] }, { status: 400 });
    }

    // Hash and update to new password
    const newHash = await argon2.hash(newPassword);
    await queryNeon(
      `UPDATE public.auth_users
       SET password_hash = $1, updated_at = now()
       WHERE user_id = $2`,
      [newHash, userId]
    );

    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
