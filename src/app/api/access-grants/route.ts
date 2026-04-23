import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const eventRow = await queryNeonOne<{ user_id: string | null }>(
      `SELECT user_id FROM public.events WHERE id = $1`,
      [eventId],
    );
    const eventErr = eventRow ? null : { message: "Event not found" };
    if (eventErr || !eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (eventRow.user_id !== userId) return NextResponse.json({ data: [] }, { status: 200 });

    const grants = await queryNeon<{
      id: string;
      grantee_user_id: string;
      permission: string;
      status: string;
      created_at: string;
    }>(
      `SELECT id, grantee_user_id, permission, status, created_at
       FROM public.access_grants
       WHERE event_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT $2
       OFFSET $3`,
      [eventId, limit, offset],
    );
    const countRow = await queryNeonOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM public.access_grants
       WHERE event_id = $1 AND status = 'active'`,
      [eventId],
    );
    const granteeIds = Array.from(new Set(grants.map((g) => g.grantee_user_id)));
    const emailRows = granteeIds.length
      ? await queryNeon<{ user_id: string; email: string }>(
          `SELECT user_id, email
           FROM public.auth_users
           WHERE user_id = ANY($1::uuid[])`,
          [granteeIds],
        )
      : [];
    const emailByUserId = new Map(emailRows.map((r) => [r.user_id, r.email]));

    const enriched = grants.map((g) => ({
      ...g,
      grantee_email: emailByUserId.get(g.grantee_user_id) || "unknown",
    }));

    return NextResponse.json(
      {
        data: enriched,
        pagination: {
          limit,
          offset,
          total: Number(countRow?.count || 0),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load grants.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
