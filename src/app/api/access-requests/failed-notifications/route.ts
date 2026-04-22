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
    // Hide notification failure UI when email delivery is intentionally disabled.
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ data: [] }, { status: 200 });
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

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .select("id, event_id, requested_action, status, notification_error, created_at, requester_user_id")
      .eq("owner_user_id", userId)
      .not("notification_error", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const enriched = await Promise.all(
      (data || []).map(async (row) => {
        const { data: requesterData } = await supabaseAdmin.auth.admin.getUserById(row.requester_user_id);
        if (!row.event_id) {
          return {
            ...row,
            event_name: "Organization Workspace",
            requester_email: requesterData?.user?.email || "unknown",
          };
        }
        const { data: eventData } = await supabaseAdmin.from("events").select("name").eq("id", row.event_id).maybeSingle();
        return {
          ...row,
          event_name: String(eventData?.name || "Organization Workspace"),
          requester_email: requesterData?.user?.email || "unknown",
        };
      }),
    );

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load failed notifications." }, { status: 500 });
  }
}
