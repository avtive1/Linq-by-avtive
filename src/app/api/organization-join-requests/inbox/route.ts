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
      requester_user_id: string;
      requested_org_name: string;
      status: string;
      created_at: string;
    }>(
      `SELECT id, requester_user_id, requested_org_name, status, created_at
       FROM public.organization_join_requests
       WHERE owner_user_id = $1
         AND status = 'pending'
       ORDER BY created_at DESC`,
      [userId],
    );

    const rows = await Promise.all(
      data.map(async (row) => {
        const requesterEmail = await getAdminUserEmailById(row.requester_user_id);
        return {
          ...row,
          requester_email: requesterEmail || "unknown",
        };
      }),
    );

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load join request inbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
