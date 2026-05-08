import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";

const ORG_MANAGED_PERMISSIONS = new Set(["create_event", "manage_event", "edit_cards", "delete_cards"]);

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
      event_id: string | null;
    }>(
      `SELECT id, grantee_user_id, permission, status, created_at, event_id
       FROM public.access_grants
       WHERE status = 'active'
         AND (
           event_id = $1
           OR (event_id IS NULL AND granted_by_user_id = $4)
         )
       ORDER BY created_at DESC
       LIMIT $2
       OFFSET $3`,
      [eventId, limit, offset, userId],
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
      scope: g.event_id ? "event" : "organization",
    }));
    const dedupedMap = new Map<string, (typeof enriched)[number]>();
    for (const grant of enriched) {
      const isOrgManagedPermission = ORG_MANAGED_PERMISSIONS.has(grant.permission);
      const key = isOrgManagedPermission
        ? `${grant.grantee_user_id}:${grant.permission}`
        : `${grant.grantee_user_id}:${grant.event_id || "organization"}:${grant.permission}`;
      const existing = dedupedMap.get(key);
      if (!existing) {
        dedupedMap.set(key, grant);
        continue;
      }
      // Prefer org-level row for org-managed permissions for clearer access-control display.
      if (!existing.event_id && grant.event_id) continue;
      if (existing.event_id && !grant.event_id) {
        dedupedMap.set(key, grant);
      }
    }
    const deduped = Array.from(dedupedMap.values());

    return NextResponse.json(
      {
        data: deduped,
        pagination: {
          limit,
          offset,
          total: deduped.length,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load grants.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
