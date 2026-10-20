import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { changeUserPassword } from "@/lib/auth-db";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const result = await changeUserPassword(session.user.id, currentPassword, newPassword);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to change password." },
        { status: 400 },
      );
    }

    // Sync password change with Supabase Auth
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.updateUser({ password: newPassword });
    } catch {
      // Ignore external sync errors
    }

    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
