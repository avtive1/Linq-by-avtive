import { NextResponse } from "next/server";
import { insertRow, queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerAuthSession } from "@/auth";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { getDefaultRegistrationFormConfig, normalizeRegistrationFormConfig } from "@/lib/registration-form";

function getViewerAdminAccess(params: {
  viewerId: string;
  sessionUserId: string;
  sessionRole: string;
  sessionEmail: string;
}) {
  const { viewerId, sessionUserId, sessionRole, sessionEmail } = params;
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    isAdminByRole: sessionUserId === viewerId && sessionRole === "admin",
    isAdminByEmail: Boolean(sessionUserId === viewerId && sessionEmail && adminEmails.includes(sessionEmail)),
  };
}

export async function GET(req: Request) {
  try {
    const session = await getServerAuthSession();
    const viewerId = String(session?.user?.id || "").trim();
    if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sessionRole = String(session?.user?.role || "").toLowerCase();
    const sessionEmail = String(session?.user?.email || "").toLowerCase().trim();

    const url = new URL(req.url);
    const ownerId = String(url.searchParams.get("ownerId") || viewerId);

    const { isAdminByRole, isAdminByEmail } = getViewerAdminAccess({
      viewerId,
      sessionUserId: viewerId,
      sessionRole,
      sessionEmail,
    });
    let canView = ownerId === viewerId || isAdminByRole || isAdminByEmail;
    if (!canView) {
      const member = await queryNeonOne<{ id: string }>(
        `SELECT id
         FROM public.organization_members
         WHERE member_user_id = $1
           AND org_owner_user_id = $2
           AND status = 'active'
         LIMIT 1`,
        [viewerId, ownerId],
      );
      canView = Boolean(member?.id);
    }
    if (!canView) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const rows = await queryNeon<{
      id: string;
      name: string;
      location: string;
      date: string;
      logo_url: string | null;
      attendee_count: string | number;
    }>(
      `SELECT e.id, e.name, e.location, e.date, e.logo_url, COUNT(a.id)::int AS attendee_count
       FROM public.events e
       LEFT JOIN public.attendees a ON a.event_id = e.id
       WHERE e.user_id = $1
       GROUP BY e.id
       ORDER BY MAX(e.created_at) DESC`,
      [ownerId],
    );

    return NextResponse.json(
      {
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          location: row.location,
          date: row.date,
          logo_url: row.logo_url,
          attendeeCount: Number(row.attendee_count || 0),
        })),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load events.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await queryNeon(
      `ALTER TABLE public.events
       ADD COLUMN IF NOT EXISTS registration_form_config jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const session = await getServerAuthSession();
    const viewerId = String(session?.user?.id || "").trim();
    if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sessionRole = String(session?.user?.role || "").toLowerCase();
    const sessionEmail = String(session?.user?.email || "").toLowerCase().trim();

    const body = (await req.json()) as {
      name?: string;
      location?: string;
      location_type?: "onsite" | "webinar";
      date?: string;
      time?: string;
      logo_url?: string;
      ownerId?: string;
      registration_form_config?: unknown;
    };

    const ownerId = String(body.ownerId || viewerId);
    const payload = {
      name: String(body.name || "").trim(),
      location: String(body.location || "").trim(),
      location_type: body.location_type || "onsite",
      date: String(body.date || ""),
      time: String(body.time || ""),
      logo_url: String(body.logo_url || ""),
      registration_form_config: normalizeRegistrationFormConfig(
        body.registration_form_config || getDefaultRegistrationFormConfig(),
      ),
    };

    if (!payload.name || !payload.location || !payload.date || !payload.time) {
      return NextResponse.json({ error: "Missing required event fields." }, { status: 400 });
    }

    const { isAdminByRole, isAdminByEmail } = getViewerAdminAccess({
      viewerId,
      sessionUserId: viewerId,
      sessionRole,
      sessionEmail,
    });
    let canCreate = ownerId === viewerId || isAdminByRole || isAdminByEmail;
    if (!canCreate) {
      const member = await queryNeonOne<{ id: string }>(
        `SELECT id
         FROM public.organization_members
         WHERE member_user_id = $1
           AND org_owner_user_id = $2
           AND status = 'active'
         LIMIT 1`,
        [viewerId, ownerId],
      );
      if (member?.id) {
        const grant = await queryNeonOne<{ id: string }>(
          `SELECT g.id
           FROM public.access_grants g
           LEFT JOIN public.events e
             ON e.id = g.event_id
           WHERE g.grantee_user_id = $1
             AND g.status = 'active'
             AND g.permission = 'create_event'
             AND (
               e.user_id = $2
               OR g.granted_by_user_id = $2
             )
           LIMIT 1`,
          [viewerId, ownerId],
        );
        canCreate = Boolean(grant?.id);
      }
    }
    if (!canCreate) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const created = await insertRow(
      "events",
      {
        ...payload,
        user_id: ownerId,
        registration_form_config: payload.registration_form_config,
      },
      "id",
    );
    if (!created?.id) return NextResponse.json({ error: "Failed to create event." }, { status: 400 });

    return NextResponse.json({ data: { id: String(created.id) } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
