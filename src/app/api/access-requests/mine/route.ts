import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requests = await queryNeon<{
      id: string;
      event_id: string | null;
      requested_action: string;
      status: string;
      created_at: string;
      reviewed_at: string | null;
    }>(
      `SELECT id, event_id, requested_action, status, created_at, reviewed_at
       FROM public.access_requests
       WHERE requester_user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );

    const enriched = await Promise.all(
      requests.map(async (r) => {
        if (!r.event_id) {
          return { ...r, event_name: "Organization Workspace" };
        }
        const eventData = await queryNeonOne<{ name: string }>(
          `SELECT name FROM public.events WHERE id = $1`,
          [r.event_id],
        );
        return { ...r, event_name: eventData?.name || "Organization Workspace" };
      }),
    );

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load your requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
