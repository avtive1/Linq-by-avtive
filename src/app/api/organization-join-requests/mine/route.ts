import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await queryNeon<{
      id: string;
      owner_user_id: string;
      requested_org_name: string;
      status: string;
      created_at: string;
      reviewed_at: string | null;
      reapply_after: string | null;
      rejection_reason: string | null;
    }>(
      `SELECT id, owner_user_id, requested_org_name, status, created_at, reviewed_at, reapply_after, rejection_reason
       FROM public.organization_join_requests
       WHERE requester_user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    );

    const rows = await Promise.all(
      data.map(async (row) => {
        const ownerEmail = await getAdminUserEmailById(row.owner_user_id);
        return {
          ...row,
          owner_email: ownerEmail || "unknown",
        };
      }),
    );

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load your join requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
