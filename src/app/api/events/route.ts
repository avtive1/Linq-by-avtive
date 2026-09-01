import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { insertRow, queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerAuthSession } from "@/auth";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { getDefaultRegistrationFormConfig, normalizeRegistrationFormConfig } from "@/lib/registration-form";
import { sanitizeStoredCardFont } from "@/lib/card-fonts";
import { apiRouteErrorResponse, withApiTenantContext } from "@/lib/tenant/api-context";

function isPastEventDate(dateStr: string) {
  const parsed = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bufferTime = new Date(today.getTime() - 48 * 60 * 60 * 1000);
  return parsed < bufferTime;
}

import { getOrGenerateUniqueShortId } from "@/lib/events/short-id";

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
    const cookieStore = await cookies();
    return await withApiTenantContext(cookieStore, async () => {
      const session = await getServerAuthSession();
    const viewerId = String(session?.user?.id || "").trim();
    if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sessionRole = String(session?.user?.role || "").toLowerCase();
    const sessionEmail = String(session?.user?.email || "").toLowerCase().trim();

    const url = new URL(req.url);
    const ownerId = String(url.searchParams.get("ownerId") || viewerId);
    const includeRoleStats = url.searchParams.get("includeRoleStats") === "true";

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

    const eventsQuery = queryNeon<{
      id: string;
      name: string;
      description: string;
      location: string;
      date: string;
      logo_url: string | null;
      short_id: string | null;
      attendee_count: string | number;
    }>(
      `SELECT e.id, e.name, e.description, e.location, e.date, e.logo_url, e.short_id, COUNT(a.id)::int AS attendee_count
       FROM public.events e
       LEFT JOIN public.attendees a ON a.event_id = e.id
       WHERE e.user_id = $1
       GROUP BY e.id
       ORDER BY MAX(e.created_at) DESC`,
      [ownerId],
    );

    const roleStatsQuery = includeRoleStats
      ? queryNeon<{ role: string; count: string | number }>(
          `SELECT a.role, COUNT(*)::int AS count
           FROM public.attendees a
           INNER JOIN public.events e ON e.id = a.event_id
           WHERE e.user_id = $1
             AND NULLIF(TRIM(a.role), '') IS NOT NULL
           GROUP BY a.role
           ORDER BY count DESC, a.role ASC
           LIMIT 5`,
          [ownerId],
        )
      : Promise.resolve([] as Array<{ role: string; count: string | number }>);

    const [rows, roleStats] = await Promise.all([eventsQuery, roleStatsQuery]);

    return NextResponse.json(
      {
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          location: row.location,
          date: row.date,
          logo_url: row.logo_url,
          shortId: row.short_id,
          attendeeCount: Number(row.attendee_count || 0),
        })),
        topRoles: roleStats.map((row) => ({
          role: row.role,
          count: Number(row.count || 0),
        })),
      },
      { status: 200 },
    );
    }, { allowAdminBypass: true });
  } catch (error: unknown) {
    return apiRouteErrorResponse(error, "Failed to load events.");
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    return await withApiTenantContext(cookieStore, async () => {
      const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const session = await getServerAuthSession();
    const viewerId = String(session?.user?.id || "").trim();
    if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sessionRole = String(session?.user?.role || "").toLowerCase();
    const sessionEmail = String(session?.user?.email || "").toLowerCase().trim();

    const body = (await req.json()) as {
      name?: string;
      description?: string;
      location?: string;
      location_type?: "onsite" | "webinar";
      date?: string;
      time?: string;
      logo_url?: string;
      ownerId?: string;
      registration_form_config?: unknown;
      card_color?: string;
      card_font?: string;
      horizontal_text_color?: string;
      vertical_text_color?: string;
      is_branding_finalized?: boolean;
    };

    const ownerId = String(body.ownerId || viewerId);
    const payload = {
      name: String(body.name || "").trim(),
      description: String(body.description || "").trim().slice(0, 220),
      location: String(body.location || "").trim(),
      location_type: body.location_type || "onsite",
      date: String(body.date || ""),
      time: String(body.time || "10:00").trim() || "10:00",
      logo_url: String(body.logo_url || ""),
      registration_form_config: normalizeRegistrationFormConfig(
        body.registration_form_config || getDefaultRegistrationFormConfig(),
      ),
      card_color: String(body.card_color || "purple").trim() || "purple",
      card_font: sanitizeStoredCardFont(body.card_font),
      horizontal_text_color: String(body.horizontal_text_color || "").trim(),
      vertical_text_color: String(body.vertical_text_color || "").trim(),
      is_branding_finalized: Boolean(body.is_branding_finalized ?? false),
    };

    if (!payload.name || !payload.location || !payload.date) {
      return NextResponse.json({ error: "Missing required event fields." }, { status: 400 });
    }
    if (isPastEventDate(payload.date)) {
      return NextResponse.json({ error: "Event date must be today or in the future." }, { status: 400 });
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

    let created: Record<string, unknown> | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const uniqueShortId = await getOrGenerateUniqueShortId();
        created = await insertRow(
          "events",
          {
            ...payload,
            short_id: uniqueShortId,
            user_id: ownerId,
            registration_form_config: payload.registration_form_config,
          },
          "id",
        );
        if (created?.id) break;
      } catch (err: unknown) {
        lastError = err;
        const errStr = String(err instanceof Error ? err.message : err);
        const isDuplicateKey =
          errStr.includes("unique constraint") ||
          errStr.includes("duplicate key") ||
          errStr.includes("events_short_id_key") ||
          errStr.includes("23505") ||
          (typeof err === "object" && err !== null && "code" in err && String((err as { code?: string }).code) === "23505");
        if (isDuplicateKey && attempt < 4) {
          await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    if (!created?.id) {
      const message = lastError instanceof Error ? lastError.message : "Failed to create event.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ data: { id: String(created.id) } }, { status: 201 });
    }, { allowAdminBypass: true });
  } catch (error: unknown) {
    return apiRouteErrorResponse(error, "Failed to create event.");
  }
}
