import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne, queryNeonOneAsSystem, queryNeonAsSystem } from "@/lib/neon-db";
import { deleteTenantRows, updateTenantRows } from "@/lib/db/tenant-mutations";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getServerAuthSession } from "@/auth";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";
import { normalizeRegistrationFormConfig } from "@/lib/registration-form";
import { sanitizeStoredCardFont } from "@/lib/card-fonts";
import { apiRouteErrorResponse, withApiTenantContext } from "@/lib/tenant/api-context";

function isPastEventDate(dateStr: string) {
  const parsed = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  return parsed < yesterday;
}

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
  const eventRow = await queryNeonOneAsSystem<{
    id: string;
    user_id: string;
    name: string;
    description: string;
    location: string;
    location_type: "onsite" | "webinar" | null;
    date: string;
    time: string | null;
    logo_url: string | null;
    sponsors: unknown;
    registration_form_config: unknown;
    card_color?: string;
    card_font?: string;
    horizontal_text_color?: string;
    vertical_text_color?: string;
    is_branding_finalized?: boolean;
    short_id: string | null;
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

  const membership = await queryNeonOneAsSystem<{ id: string }>(
    `SELECT id
     FROM public.organization_members
     WHERE member_user_id = $1
       AND org_owner_user_id = $2
       AND status = 'active'
     LIMIT 1`,
    [viewerId, eventRow.user_id],
  );
  const isOrgMemberViewer = Boolean(membership?.id);

  const grants = await queryNeonAsSystem<{ permission: string }>(
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
    const cookieStore = await cookies();
    return await withApiTenantContext(cookieStore, async () => {
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
    }, { allowAdminBypass: true });
  } catch (error: unknown) {
    return apiRouteErrorResponse(error, "Failed to load event.");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    return await withApiTenantContext(cookieStore, async () => {
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
      "description",
      "location",
      "location_type",
      "date",
      "time",
      "logo_url",
      "sponsors",
      "registration_form_config",
      "card_color",
      "card_font",
      "horizontal_text_color",
      "vertical_text_color",
      "is_branding_finalized",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === "description") {
          patch[key] = String(body[key] || "").trim().slice(0, 220);
        } else {
          patch[key] = body[key];
        }
      }
    }
    if ("sponsors" in patch) {
      try {
        patch.sponsors = JSON.stringify(patch.sponsors ?? []);
      } catch {
        return NextResponse.json({ error: "Invalid sponsors payload." }, { status: 400 });
      }
    }
    if ("registration_form_config" in patch) {
      patch.registration_form_config = normalizeRegistrationFormConfig(patch.registration_form_config);
    }
    if ("card_font" in patch) {
      patch.card_font = sanitizeStoredCardFont(patch.card_font);
    }

    if ("date" in patch) {
      const nextDate = String(patch.date || "").trim();
      if (!nextDate) {
        return NextResponse.json({ error: "Event date is required." }, { status: 400 });
      }
      if (isPastEventDate(nextDate)) {
        return NextResponse.json({ error: "Event date must be today or in the future." }, { status: 400 });
      }
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
    }

    const updated = await updateTenantRows("events", patch, { id }, eventRow.user_id, "id");
    if (!updated.length) return NextResponse.json({ error: "Failed to update event." }, { status: 400 });
    return NextResponse.json({ success: true }, { status: 200 });
    }, { allowAdminBypass: true });
  } catch (error: unknown) {
    return apiRouteErrorResponse(error, "Failed to update event.");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    return await withApiTenantContext(cookieStore, async () => {
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

      const deleted = await deleteTenantRows("events", { id }, eventRow.user_id);
      if (!deleted.length) return NextResponse.json({ error: "Failed to delete event." }, { status: 400 });
      return NextResponse.json({ success: true }, { status: 200 });
    }, { allowAdminBypass: true });
  } catch (error: unknown) {
    return apiRouteErrorResponse(error, "Failed to delete event.");
  }
}
