import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserById } from "@/lib/admin";
import { queryNeonOne } from "@/lib/neon-db";
import { parseEventSponsors } from "@/lib/sponsors";
import { isValidUuid } from "@/lib/validation/uuid";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid event id." }, { status: 400 });

    const eventRow = await queryNeonOne<{
      user_id: string | null;
      name: string | null;
      location: string | null;
      date: string | null;
      time: string | null;
      sponsors: unknown;
    }>(
      `SELECT user_id, name, location, date, time, sponsors
       FROM public.events
       WHERE id = $1`,
      [id],
    );
    const eventErr = eventRow ? null : { message: "Event not found." };

    if (eventErr || !eventRow?.user_id) {
      return NextResponse.json(
        {
          data: {
            organizationName: "",
            organizationLogoUrl: "",
            eventName: "",
            eventLocation: "",
            eventDate: "",
            eventTime: "",
            sponsors: [],
          },
        },
        { status: 200 },
      );
    }

    if (!userId) {
      // Public callers may only see event-level presentation metadata.
      return NextResponse.json(
        {
          data: {
            organizationName: "",
            organizationLogoUrl: "",
            eventName: String(eventRow.name || ""),
            eventLocation: String(eventRow.location || ""),
            eventDate: String(eventRow.date || ""),
            eventTime: String(eventRow.time || ""),
            sponsors: parseEventSponsors(eventRow.sponsors),
          },
        },
        { status: 200 },
      );
    }

    const [userData, profileData] = await Promise.all([
      getAdminUserById(eventRow.user_id).catch(() => null),
      queryNeonOne<{ organization_name: string | null; organization_logo_url: string | null }>(
        `SELECT
           organization_name,
           to_jsonb(p.*)->>'organization_logo_url' AS organization_logo_url
         FROM public.profiles p
         WHERE id = $1`,
        [eventRow.user_id],
      ),
    ]);

    const organizationName =
      profileData?.organization_name ||
      (typeof userData?.publicMetadata?.organization_name === "string"
        ? String(userData.publicMetadata.organization_name)
        : "");
    const organizationLogoUrl =
      profileData?.organization_logo_url ||
      (typeof userData?.publicMetadata?.organization_logo_url === "string"
        ? String(userData.publicMetadata.organization_logo_url)
        : "");

    return NextResponse.json(
      {
        data: {
          organizationName,
          organizationLogoUrl,
          eventName: String(eventRow.name || ""),
          eventLocation: String(eventRow.location || ""),
          eventDate: String(eventRow.date || ""),
          eventTime: String(eventRow.time || ""),
          sponsors: parseEventSponsors(eventRow.sponsors),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load branding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
