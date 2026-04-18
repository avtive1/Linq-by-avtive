import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updatePayload = await req.json();

    // 1. Authenticate user via cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch the attendee to check permissions
    const { data: attendee, error: fetchError } = await supabaseAdmin
      .from("attendees")
      .select("event_id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !attendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }

    // 3. Verify permissions: Does this user own the event, or the card?
    let canEdit = false;
    if (attendee.event_id) {
      const { data: event } = await supabaseAdmin
        .from("events")
        .select("user_id")
        .eq("id", attendee.event_id)
        .single();
      if (event && event.user_id === session.user.id) {
        canEdit = true;
      }
    } else if (attendee.user_id === session.user.id) {
      canEdit = true;
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to edit this card" }, { status: 403 });
    }

    // 4. Perform the update with Service Role to bypass RLS failures on NULL user_ids
    const { data, error: updateError } = await supabaseAdmin
      .from("attendees")
      .update(updatePayload)
      .eq("id", id)
      .select();

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("API Error in PATCH /api/cards/[id]:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
