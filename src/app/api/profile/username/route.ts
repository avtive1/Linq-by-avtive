import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeonOne, updateRows } from "@/lib/neon-db";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";
import { getServerUserIdFromCookies } from "@/lib/auth-server";

const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;
const USERNAME_CHANGE_COOLDOWN_DAYS = 24;
const ORG_CHANGE_COOLDOWN_DAYS = 90;

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; organizationName?: string; organizationLogoUrl?: string };
    const nextUsername = String(body?.username || "").trim().toLowerCase();
    const nextOrganizationName = normalizeOrganizationName(String(body?.organizationName || ""));
    const nextOrganizationLogoUrl = String(body?.organizationLogoUrl || "").trim();

    if (!nextUsername) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }
    if (nextUsername.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
    }
    if (!USERNAME_REGEX.test(nextUsername)) {
      return NextResponse.json({ error: "Use letters, numbers, underscore, or dot only." }, { status: 400 });
    }
    if (!nextOrganizationName) {
      return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    }
    if (nextOrganizationName.length > 120) {
      return NextResponse.json({ error: "Organization name is too long." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentProfile = await queryNeonOne<{
      username: string | null;
      organization_name: string | null;
      username_changed_at: string | null;
      organization_name_changed_at: string | null;
    }>(
      `SELECT username, organization_name, username_changed_at, organization_name_changed_at
       FROM public.profiles
       WHERE id = $1`,
      [userId],
    );
    const profileError = currentProfile ? null : { message: "Profile not found." };

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const membershipRow = await queryNeonOne<{ id: string }>(
      `SELECT id
       FROM public.organization_members
       WHERE member_user_id = $1
         AND status = 'active'
       LIMIT 1`,
      [userId],
    );

    const currentOrganizationKey = toOrganizationKey(String(currentProfile.organization_name || ""));
    const ownedOrganization = await queryNeonOne<{ id: string; owner_user_id: string }>(
      `SELECT id, owner_user_id
       FROM public.organizations
       WHERE organization_name_key = $1
       LIMIT 1`,
      [currentOrganizationKey],
    );

    const isOrganizationMember = Boolean(membershipRow?.id);
    const isOrganizationOwner = Boolean(ownedOrganization?.owner_user_id === userId);
    if (
      isOrganizationMember &&
      !isOrganizationOwner &&
      (currentProfile.organization_name || "").trim().toLowerCase() !== nextOrganizationName
    ) {
      return NextResponse.json(
        { error: "Only organization admin can change organization name." },
        { status: 403 },
      );
    }

    const now = Date.now();
    const usernameChanged = (currentProfile.username || "").trim().toLowerCase() !== nextUsername;
    const organizationChanged = (currentProfile.organization_name || "").trim().toLowerCase() !== nextOrganizationName;

    if (usernameChanged && currentProfile.username_changed_at) {
      const last = new Date(currentProfile.username_changed_at).getTime();
      const daysElapsed = (now - last) / (1000 * 60 * 60 * 24);
      if (daysElapsed < USERNAME_CHANGE_COOLDOWN_DAYS) {
        const waitDays = Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - daysElapsed);
        return NextResponse.json(
          { error: `Username can be changed once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days. Try again in ${waitDays} day(s).` },
          { status: 429 },
        );
      }
    }

    if (organizationChanged && currentProfile.organization_name_changed_at) {
      const last = new Date(currentProfile.organization_name_changed_at).getTime();
      const daysElapsed = (now - last) / (1000 * 60 * 60 * 24);
      if (daysElapsed < ORG_CHANGE_COOLDOWN_DAYS) {
        const waitDays = Math.ceil(ORG_CHANGE_COOLDOWN_DAYS - daysElapsed);
        return NextResponse.json(
          { error: `Organization name can be changed once every ${ORG_CHANGE_COOLDOWN_DAYS} days. Try again in ${waitDays} day(s).` },
          { status: 429 },
        );
      }
    }

    const existing = await queryNeonOne<{ id: string }>(
      `SELECT id
       FROM public.profiles
       WHERE username = $1
         AND id <> $2
       LIMIT 1`,
      [nextUsername, userId],
    );

    if (existing?.id) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    const updatePayload: Record<string, unknown> = {
      username: nextUsername,
      organization_name: nextOrganizationName,
      organization_name_key: toOrganizationKey(nextOrganizationName),
    };
    if (nextOrganizationLogoUrl) {
      updatePayload.organization_logo_url = nextOrganizationLogoUrl;
    }
    if (usernameChanged) updatePayload.username_changed_at = new Date().toISOString();
    if (organizationChanged) updatePayload.organization_name_changed_at = new Date().toISOString();

    const updatedProfiles = await updateRows("profiles", updatePayload, { id: userId }, "id");
    if (!updatedProfiles.length) {
      return NextResponse.json({ error: "Failed to update profile." }, { status: 400 });
    }

    const ownedOrganizationByUser = await queryNeonOne<{ id: string; organization_name_key: string }>(
      `SELECT id, organization_name_key
       FROM public.organizations
       WHERE owner_user_id = $1
       LIMIT 1`,
      [userId],
    );

    if (ownedOrganizationByUser?.id) {
      const nextOrgKey = toOrganizationKey(nextOrganizationName);
      try {
        const updatedOrganizations = await updateRows(
          "organizations",
          {
            organization_name: nextOrganizationName,
            organization_name_key: nextOrgKey,
            updated_at: new Date().toISOString(),
          },
          { id: ownedOrganizationByUser.id },
          "id",
        );
        if (!updatedOrganizations.length) {
          return NextResponse.json({ error: "Failed to update organization." }, { status: 400 });
        }
      } catch (error: unknown) {
        const isUniqueViolation =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          String((error as { code?: string }).code) === "23505";
        if (isUniqueViolation) {
          return NextResponse.json(
            { error: "This organization name is already claimed by another organization." },
            { status: 409 },
          );
        }
        const message = error instanceof Error ? error.message : "Failed to update organization.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { data: { username: nextUsername, organizationName: nextOrganizationName } },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update username.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await queryNeonOne<{
      username: string | null;
      organization_name: string | null;
    }>(
      `SELECT username, organization_name
       FROM public.profiles
       WHERE id = $1`,
      [userId],
    );
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        data: {
          username: String(profile.username || ""),
          organizationName: String(profile.organization_name || ""),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
