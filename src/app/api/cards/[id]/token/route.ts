import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { issueAttendeeCardToken } from "@/lib/security/tokens";
import { logSecurityEvent } from "@/lib/security/telemetry";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {}
          },
        },
      },
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: attendee } = await supabaseAdmin
      .from("attendees")
      .select("id, event_id, user_id")
      .eq("id", id)
      .single();
    if (!attendee) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    let canIssue = false;
    if (attendee.event_id) {
      const { data: event } = await supabaseAdmin
        .from("events")
        .select("user_id")
        .eq("id", attendee.event_id)
        .single();
      if (event?.user_id === session.user.id) canIssue = true;
    } else if (attendee.user_id === session.user.id) {
      canIssue = true;
    }

    if (!canIssue) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const token = await issueAttendeeCardToken({
      sub: session.user.id,
      cardId: id,
      scope: "card:read",
    });

    logSecurityEvent({
      event: "security.card_token.issued",
      actorId: session.user.id,
      resourceId: id,
      details: { scope: "card:read" },
    });

    return NextResponse.json({ token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    logSecurityEvent({ event: "security.card_token.issue_failed", level: "error", details: { reason: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
