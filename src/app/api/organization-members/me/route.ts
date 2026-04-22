import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET() {
  try {
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
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .select("org_owner_user_id, role_label, status")
      .eq("member_user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (data?.org_owner_user_id) {
      // Member capabilities are sourced from actual active grants, not role template defaults.
      const { data: grants } = await supabaseAdmin
        .from("access_grants")
        .select("permission")
        .eq("grantee_user_id", userId)
        .eq("status", "active");
      const permissions = Array.from(
        new Set((grants || []).map((row: { permission: string }) => row.permission)),
      );
      return NextResponse.json({ data: { ...data, permissions } }, { status: 200 });
    }

    return NextResponse.json({ data: data || null }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load membership." }, { status: 500 });
  }
}
