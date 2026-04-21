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
      .from("organization_join_requests")
      .select("id, owner_user_id, requested_org_name, status, created_at, reviewed_at, reapply_after, rejection_reason")
      .eq("requester_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = await Promise.all(
      (data || []).map(async (row) => {
        const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(row.owner_user_id);
        return {
          ...row,
          owner_email: ownerData?.user?.email || "unknown",
        };
      }),
    );

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load your join requests." }, { status: 500 });
  }
}
