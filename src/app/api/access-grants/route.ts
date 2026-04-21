import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

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

    const { data: eventRow, error: eventErr } = await supabaseAdmin
      .from("events")
      .select("user_id")
      .eq("id", eventId)
      .single();
    if (eventErr || !eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (eventRow.user_id !== userId) return NextResponse.json({ data: [] }, { status: 200 });

    const { data: grants, error } = await supabaseAdmin
      .from("access_grants")
      .select("id, grantee_user_id, permission, status, created_at")
      .eq("event_id", eventId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const enriched = await Promise.all(
      (grants || []).map(async (g) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(g.grantee_user_id);
        return { ...g, grantee_email: userData?.user?.email || "unknown" };
      }),
    );

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load grants." }, { status: 500 });
  }
}
