import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserById } from "@/lib/admin";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { parseEventSponsors } from "@/lib/sponsors";
import { isValidUuid } from "@/lib/validation/uuid";
import { ensureAuthSchema } from "@/lib/auth-db";
import { normalizeRegistrationFormConfig } from "@/lib/registration-form";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAuthSchema();
    await queryNeon(
      `ALTER TABLE public.events
       ADD COLUMN IF NOT EXISTS registration_form_config jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
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
      logo_url: string | null;
      sponsors: unknown;
      registration_form_config: unknown;
    }>(
      `SELECT user_id, name, location, date, time, logo_url, sponsors, registration_form_config
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
            registrationFormConfig: normalizeRegistrationFormConfig(null),
          },
        },
        { status: 200 },
      );
    }

    if (!userId) {
      // Public share links should resolve organization branding for attendee registration.
      const publicProfile = await queryNeonOne<{ organization_name: string | null; organization_logo_url: string | null }>(
        `SELECT
           organization_name,
           to_jsonb(p.*)->>'organization_logo_url' AS organization_logo_url
         FROM public.profiles p
         WHERE id = $1`,
        [eventRow.user_id],
      );
      const campaignLogoUrl = String(eventRow.logo_url || "").trim();

      return NextResponse.json(
        {
          data: {
            organizationName: String(publicProfile?.organization_name || ""),
            organizationLogoUrl: campaignLogoUrl || String(publicProfile?.organization_logo_url || ""),
            eventName: String(eventRow.name || ""),
            eventLocation: String(eventRow.location || ""),
            eventDate: String(eventRow.date || ""),
            eventTime: String(eventRow.time || ""),
            sponsors: parseEventSponsors(eventRow.sponsors),
            registrationFormConfig: normalizeRegistrationFormConfig(eventRow.registration_form_config),
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
      (profileData?.organization_name || "").trim() ||
      (typeof userData?.publicMetadata?.organization_name === "string"
        ? String(userData.publicMetadata.organization_name)
        : "");

    const campaignLogoUrl = String(eventRow.logo_url || "").trim();
    const organizationLogoUrl =
      campaignLogoUrl ||
      (profileData?.organization_logo_url || "").trim() ||
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
          registrationFormConfig: normalizeRegistrationFormConfig(eventRow.registration_form_config),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load branding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
