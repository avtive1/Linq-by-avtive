import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerAuthSession } from "@/auth";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getDefaultRegistrationFormConfig, normalizeRegistrationFormConfig } from "@/lib/registration-form";
import { sanitizeStoredCardFont } from "@/lib/card-fonts";
import { apiRouteErrorResponse, withApiTenantContext } from "@/lib/tenant/api-context";
import { getOrGenerateUniqueShortId } from "@/lib/events/short-id";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

function isPastEventDate(dateStr: string) {
  const parsed = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bufferTime = new Date(today.getTime() - 48 * 60 * 60 * 1000);
  return parsed < bufferTime;
}

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
    const session = await getServerAuthSession();
    const viewerId = String(session?.user?.id || "").trim();
    if (!viewerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json();

    // Safely destructure expected fields and explicitly strip non-column fields like _uniqueId
    const {
      name,
      description = "",
      location,
      location_type = "onsite",
      date,
      time = "10:00",
      ownerId,
      logo_url = "",
      registration_form_config,
      card_color = "purple",
      card_font,
      horizontal_text_color = "",
      vertical_text_color = "",
      is_branding_finalized = false,
      _uniqueId,
    } = rawBody;

    // Validate required fields
    const trimmedName = String(name || "").trim();
    const trimmedLocation = String(location || "").trim();
    const trimmedDate = String(date || "").trim();

    if (!trimmedName || !trimmedLocation || !trimmedDate) {
      return NextResponse.json(
        { error: "Missing required event fields (name, location, date)." },
        { status: 400 }
      );
    }

    if (isPastEventDate(trimmedDate)) {
      return NextResponse.json(
        { error: "Event date must be today or in the future." },
        { status: 400 }
      );
    }

    // Map ownerId to the database column user_id
    const targetUserId = String(ownerId || viewerId).trim();

    // Generate guaranteed unique short_id using _uniqueId candidate if valid
    const safeShortId = await getOrGenerateUniqueShortId(_uniqueId);

    // Prepare clean database row matching public.events schema
    const insertPayload = {
      name: trimmedName,
      description: String(description || "").trim().slice(0, 220),
      location: trimmedLocation,
      location_type: location_type === "webinar" ? "webinar" : "onsite",
      date: trimmedDate,
      time: String(time || "10:00").trim() || "10:00",
      logo_url: String(logo_url || ""),
      user_id: targetUserId,
      short_id: safeShortId,
      registration_form_config: normalizeRegistrationFormConfig(
        registration_form_config || getDefaultRegistrationFormConfig()
      ),
      card_color: String(card_color || "purple").trim() || "purple",
      card_font: sanitizeStoredCardFont(card_font),
      horizontal_text_color: String(horizontal_text_color || "").trim(),
      vertical_text_color: String(vertical_text_color || "").trim(),
      is_branding_finalized: Boolean(is_branding_finalized ?? false),
    };

    // Insert into Supabase / PostgreSQL
    const { data, error } = await supabase
      .from("events")
      .insert([insertPayload])
      .select("id, short_id")
      .single();

    if (error) {
      console.error("[POST /api/events] Supabase Insert Error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to insert event into database." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { data: { id: data.id, shortId: data.short_id }, success: true },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[POST /api/events] Route Error:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}