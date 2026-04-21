import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";

const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;
const USERNAME_CHANGE_COOLDOWN_DAYS = 24;
const ORG_CHANGE_COOLDOWN_DAYS = 90;

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; organizationName?: string };
    const nextUsername = String(body?.username || "").trim().toLowerCase();
    const nextOrganizationName = normalizeOrganizationName(String(body?.organizationName || ""));

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
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      },
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();
    const userId = session.user.id;

    const { data: currentProfile, error: profileError } = await admin
      .from("profiles")
      .select("username, organization_name, username_changed_at, organization_name_changed_at")
      .eq("id", userId)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const { data: membershipRow } = await admin
      .from("organization_members")
      .select("id")
      .eq("member_user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const currentOrganizationKey = toOrganizationKey(String(currentProfile.organization_name || ""));
    const { data: ownedOrganization } = await admin
      .from("organizations")
      .select("id, owner_user_id")
      .eq("organization_name_key", currentOrganizationKey)
      .maybeSingle();

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

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", nextUsername)
      .neq("id", userId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    const updatePayload: Record<string, unknown> = {
      username: nextUsername,
      organization_name: nextOrganizationName,
      organization_name_key: toOrganizationKey(nextOrganizationName),
    };
    if (usernameChanged) updatePayload.username_changed_at = new Date().toISOString();
    if (organizationChanged) updatePayload.organization_name_changed_at = new Date().toISOString();

    const { error: updateError } = await admin.from("profiles").update(updatePayload).eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const { data: ownedOrganizationByUser } = await admin
      .from("organizations")
      .select("id, organization_name_key")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (ownedOrganizationByUser?.id) {
      const nextOrgKey = toOrganizationKey(nextOrganizationName);
      const { error: orgUpdateError } = await admin
        .from("organizations")
        .update({
          organization_name: nextOrganizationName,
          organization_name_key: nextOrgKey,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ownedOrganizationByUser.id);

      if (orgUpdateError) {
        if (orgUpdateError.code === "23505") {
          return NextResponse.json(
            { error: "This organization name is already claimed by another organization." },
            { status: 409 },
          );
        }
        return NextResponse.json({ error: orgUpdateError.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { data: { username: nextUsername, organizationName: nextOrganizationName } },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update username." }, { status: 500 });
  }
}
