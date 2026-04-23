import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { insertRow, queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      username?: string;
      organizationName?: string;
      organizationLogoUrl?: string;
      linkedin?: string;
      email?: string;
    };

    const username = String(body.username || "").trim().toLowerCase();
    const organizationName = normalizeOrganizationName(String(body.organizationName || ""));
    const organizationNameKey = toOrganizationKey(organizationName);

    if (!username || username.length < 3) {
      return NextResponse.json({ error: "Invalid username." }, { status: 400 });
    }
    if (!organizationName || !organizationNameKey) {
      return NextResponse.json({ error: "Invalid organization name." }, { status: 400 });
    }

    const existing = await queryNeonOne<{ id: string }>(
      `SELECT id FROM public.profiles WHERE id = $1`,
      [userId],
    );
    if (existing) {
      await updateRows(
        "profiles",
        {
          username,
          organization_name: organizationName,
          organization_name_key: organizationNameKey,
          updated_at: new Date().toISOString(),
        },
        { id: userId },
        "id",
      );
    } else {
      await insertRow("profiles", {
        id: userId,
        username,
        organization_name: organizationName,
        organization_name_key: organizationNameKey,
      });
    }

    const currentOrg = await queryNeonOne<{ id: string }>(
      `SELECT id FROM public.organizations WHERE organization_name_key = $1`,
      [organizationNameKey],
    );
    if (!currentOrg) {
      await insertRow("organizations", {
        organization_name: organizationName,
        organization_name_key: organizationNameKey,
        owner_user_id: userId,
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
