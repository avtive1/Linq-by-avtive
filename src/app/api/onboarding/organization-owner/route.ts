import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";

async function getCurrentUserId() {
  const cookieStore = await cookies();
  return getServerUserIdFromCookies(cookieStore);
}

async function isOrganizationOwner(userId: string) {
  const ownerRow = await queryNeonOne<{ id: string }>(
    `SELECT id
     FROM public.organizations
     WHERE owner_user_id = $1
     LIMIT 1`,
    [userId],
  );
  return Boolean(ownerRow?.id);
}

async function ensureOwnerOnboardingColumns() {
  await queryNeon(
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS owner_onboarding_team_step_completed_at timestamptz`,
  );
  await queryNeon(
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo_url text`,
  );
}

export async function GET() {
  try {
    await ensureOwnerOnboardingColumns();
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owner = await isOrganizationOwner(userId);
    if (!owner) {
      return NextResponse.json(
        {
          data: {
            isOwner: false,
            hasOrganizationLogo: false,
            needsProfileSetup: false,
            teamStepCompleted: true,
            shouldShowOnboarding: false,
          },
        },
        { status: 200 },
      );
    }

    const profile = await queryNeonOne<{
      organization_logo_url: string | null;
      username: string | null;
      profile_photo_url: string | null;
      owner_onboarding_team_step_completed_at: string | null;
    }>(
      `SELECT
        to_jsonb(p.*)->>'organization_logo_url' AS organization_logo_url,
        username,
        to_jsonb(p.*)->>'profile_photo_url' AS profile_photo_url,
        to_jsonb(p.*)->>'owner_onboarding_team_step_completed_at' AS owner_onboarding_team_step_completed_at
       FROM public.profiles p
       WHERE p.id = $1
       LIMIT 1`,
      [userId],
    );

    const hasOrganizationLogo = Boolean(String(profile?.organization_logo_url || "").trim());
    const hasUsername = Boolean(String(profile?.username || "").trim());
    const hasProfilePhoto = Boolean(String(profile?.profile_photo_url || "").trim());
    const needsProfileSetup = !hasUsername || !hasProfilePhoto;
    const teamStepCompleted = Boolean(profile?.owner_onboarding_team_step_completed_at);
    return NextResponse.json(
      {
        data: {
          isOwner: true,
          hasOrganizationLogo,
          needsProfileSetup,
          teamStepCompleted,
          shouldShowOnboarding: !needsProfileSetup && !teamStepCompleted,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load onboarding state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    await ensureOwnerOnboardingColumns();
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owner = await isOrganizationOwner(userId);
    if (!owner) {
      return NextResponse.json({ error: "Only organization owners can update onboarding state." }, { status: 403 });
    }

    await queryNeon(
      `UPDATE public.profiles
       SET owner_onboarding_team_step_completed_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [userId],
    );

    return NextResponse.json({ data: { teamStepCompleted: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update onboarding state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
