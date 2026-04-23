import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";

export async function GET() {
  try {
    // Hide notification failure UI when email delivery is intentionally disabled.
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await queryNeon<{
      id: string;
      event_id: string | null;
      requested_action: string;
      status: string;
      notification_error: string | null;
      created_at: string;
      requester_user_id: string;
    }>(
      `SELECT id, event_id, requested_action, status, notification_error, created_at, requester_user_id
       FROM public.access_requests
       WHERE owner_user_id = $1
         AND notification_error IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    );

    const enriched = await Promise.all(
      data.map(async (row) => {
        const requesterEmail = await getAdminUserEmailById(row.requester_user_id);
        if (!row.event_id) {
          return {
            ...row,
            event_name: "Organization Workspace",
            requester_email: requesterEmail || "unknown",
          };
        }
        const eventData = await queryNeonOne<{ name: string }>(
          `SELECT name FROM public.events WHERE id = $1`,
          [row.event_id],
        );
        return {
          ...row,
          event_name: String(eventData?.name || "Organization Workspace"),
          requester_email: requesterEmail || "unknown",
        };
      }),
    );

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load failed notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
