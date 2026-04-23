import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const ownerId = await getServerUserIdFromCookies(cookieStore);
    if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requests = await queryNeon<{
      id: string;
      event_id: string | null;
      requester_user_id: string;
      requested_action: string;
      note: string | null;
      status: string;
      created_at: string;
    }>(
      `SELECT id, event_id, requester_user_id, requested_action, note, status, created_at
       FROM public.access_requests
       WHERE owner_user_id = $1
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 50`,
      [ownerId],
    );

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const requesterEmail = await getAdminUserEmailById(r.requester_user_id);
        if (!r.event_id) {
          return {
            ...r,
            requester_email: requesterEmail || "unknown",
            event_name: "Organization Workspace",
          };
        }
        const eventData = await queryNeonOne<{ name: string }>(
          `SELECT name FROM public.events WHERE id = $1`,
          [r.event_id],
        );
        return {
          ...r,
          requester_email: requesterEmail || "unknown",
          event_name: eventData?.name || "Organization Workspace",
        };
      }),
    );

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
