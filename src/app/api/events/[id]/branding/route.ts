import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = getAdminClient();

    const { data: eventRow, error: eventErr } = await admin
      .from("events")
      .select("user_id")
      .eq("id", id)
      .single();

    if (eventErr || !eventRow?.user_id) {
      return NextResponse.json({ data: { organizationName: "", organizationLogoUrl: "" } }, { status: 200 });
    }

    const [{ data: userData }, { data: profileData }] = await Promise.all([
      admin.auth.admin.getUserById(eventRow.user_id),
      admin.from("profiles").select("organization_name").eq("id", eventRow.user_id).maybeSingle(),
    ]);

    const organizationName =
      profileData?.organization_name ||
      (typeof userData?.user?.user_metadata?.organization_name === "string"
        ? userData.user.user_metadata.organization_name
        : "");
    const organizationLogoUrl =
      typeof userData?.user?.user_metadata?.organization_logo_url === "string"
        ? userData.user.user_metadata.organization_logo_url
        : "";

    return NextResponse.json({ data: { organizationName, organizationLogoUrl } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load branding." }, { status: 500 });
  }
}
