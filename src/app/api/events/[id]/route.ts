import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getServerAuthSession } from "@/auth";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";

async function getCurrentUserId() {
  const cookieStore = await cookies();
  return getServerUserIdFromCookies(cookieStore);
}

function isSessionAdmin(session: Awaited<ReturnType<typeof getServerAuthSession>>): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const role = String(session?.user?.role || "").toLowerCase();
  const email = String(session?.user?.email || "").trim().toLowerCase();
  return role === "admin" || Boolean(email && adminEmails.includes(email));
}

async function getEventAccess(eventId: string, viewerId: string, canAdminRead: boolean) {
  const eventRow = await queryNeonOne<{
    id: string;
    user_id: string;
    name: string;
    location: string;
    location_type: "onsite" | "webinar" | null;
    date: string;
    time: string | null;
    logo_url: string | null;
    sponsors: unknown;
  }>(`SELECT * FROM public.events WHERE id = $1`, [eventId]);
  if (!eventRow) return { eventRow: null, isOwner: false, permissions: [] as string[], isOrgMemberViewer: false };

  const isOwner = eventRow.user_id === viewerId;
  if (isOwner) {
    return {
      eventRow,
      isOwner: true,
      permissions: ["manage_event", "edit_cards", "delete_cards", "delete_event"],
      isOrgMemberViewer: false,
    };
  }
  if (canAdminRead) {
    return {
      eventRow,
      isOwner: false,
      permissions: ["manage_event", "edit_cards", "delete_cards", "delete_event"],
      isOrgMemberViewer: false,
    };
  }

  const membership = await queryNeonOne<{ id: string }>(
    `SELECT id
     FROM public.organization_members
     WHERE member_user_id = $1
       AND org_owner_user_id = $2
       AND status = 'active'
     LIMIT 1`,
    [viewerId, eventRow.user_id],
  );
  const isOrgMemberViewer = Boolean(membership?.id);

  const grants = await queryNeon<{ permission: string }>(
    `SELECT permission
     FROM public.access_grants
     WHERE event_id = $1
       AND grantee_user_id = $2
       AND status = 'active'`,
    [eventId, viewerId],
  );
  return { eventRow, isOwner: false, permissions: grants.map((g) => g.permission), isOrgMemberViewer };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerAuthSession();
    const viewerId = await getCurrentUserId();
    if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid event id." }, { status: 400 });

    const access = await getEventAccess(id, viewerId, isSessionAdmin(session));
    if (!access.eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const { eventRow, isOwner, permissions, isOrgMemberViewer } = access;
    if (!isOwner && !isOrgMemberViewer && permissions.length === 0) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({ data: { ...eventRow, isOwner, permissions } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const session = await getServerAuthSession();
    const viewerId = await getCurrentUserId();
    if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid event id." }, { status: 400 });

    const { eventRow, isOwner, permissions } = await getEventAccess(id, viewerId, isSessionAdmin(session));
    if (!eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (!isOwner && !permissions.includes("manage_event")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      "name",
      "location",
      "location_type",
      "date",
      "time",
      "logo_url",
      "sponsors",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }
    if ("sponsors" in patch) {
      try {
        patch.sponsors = JSON.stringify(patch.sponsors ?? []);
      } catch {
        return NextResponse.json({ error: "Invalid sponsors payload." }, { status: 400 });
      }
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
    }

    const updated = await updateRows("events", patch, { id }, "id");
    if (!updated.length) return NextResponse.json({ error: "Failed to update event." }, { status: 400 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = validateCsrfOrigin(_);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const session = await getServerAuthSession();
    const viewerId = await getCurrentUserId();
    if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid event id." }, { status: 400 });

    const { eventRow, isOwner, permissions } = await getEventAccess(id, viewerId, isSessionAdmin(session));
    if (!eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const canDeleteEvent = isOwner || permissions.includes("manage_event") || permissions.includes("delete_event");
    if (!canDeleteEvent) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const attendeeCount = await queryNeonOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.attendees WHERE event_id = $1`,
      [id],
    );
    if (Number(attendeeCount?.count || 0) > 0) {
      return NextResponse.json(
        { error: "You cannot delete an event with registered attendees." },
        { status: 409 },
      );
    }

    const deleted = await queryNeon(`DELETE FROM public.events WHERE id = $1 RETURNING id`, [id]);
    if (!deleted.length) return NextResponse.json({ error: "Failed to delete event." }, { status: 400 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
