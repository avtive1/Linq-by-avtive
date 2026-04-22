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
    const ownerId = authData.user?.id;
    if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: requests, error } = await supabaseAdmin
      .from("access_requests")
      .select("id, event_id, requester_user_id, requested_action, note, status, created_at")
      .eq("owner_user_id", ownerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const enriched = await Promise.all(
      (requests || []).map(async (r) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(r.requester_user_id);
        if (!r.event_id) {
          return {
            ...r,
            requester_email: userData?.user?.email || "unknown",
            event_name: "Organization Workspace",
          };
        }
        const { data: eventData } = await supabaseAdmin.from("events").select("name").eq("id", r.event_id).maybeSingle();
        return {
          ...r,
          requester_email: userData?.user?.email || "unknown",
          event_name: eventData?.name || "Organization Workspace",
        };
      }),
    );

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load inbox." }, { status: 500 });
  }
}
