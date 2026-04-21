import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const { data: grantRow, error: grantErr } = await supabaseAdmin
      .from("access_grants")
      .select("id, event_id")
      .eq("id", id)
      .single();
    if (grantErr || !grantRow) return NextResponse.json({ error: "Grant not found." }, { status: 404 });

    const { data: eventRow, error: eventErr } = await supabaseAdmin
      .from("events")
      .select("user_id")
      .eq("id", grantRow.event_id)
      .single();
    if (eventErr || !eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (eventRow.user_id !== userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("access_grants")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to revoke grant." }, { status: 500 });
  }
}
