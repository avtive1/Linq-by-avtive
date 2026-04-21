import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
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

    const { data: eventRow, error: eventErr } = await supabaseAdmin
      .from("events")
      .select("id, user_id")
      .eq("id", eventId)
      .single();
    if (eventErr || !eventRow) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const isEventOwner = eventRow.user_id === userId;
    let isOrgAdminReviewer = false;
    if (!isEventOwner) {
      const { data: membership } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("member_user_id", userId)
        .eq("org_owner_user_id", eventRow.user_id)
        .eq("status", "active")
        .maybeSingle();
      isOrgAdminReviewer = Boolean(membership?.id);
    }

    if (!isEventOwner && !isOrgAdminReviewer) {
      return NextResponse.json({ data: { requests: [] } }, { status: 200 });
    }

    const { data: requests, error } = await supabaseAdmin
      .from("access_requests")
      .select("id, requester_user_id, requested_action, note, status, created_at")
      .eq("event_id", eventId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const enriched = await Promise.all(
      (requests || []).map(async (r) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(r.requester_user_id);
        return {
          ...r,
          requester_email: userData?.user?.email || "unknown",
        };
      }),
    );

    return NextResponse.json({ data: { requests: enriched } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch access requests." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { eventId, requestedAction, note } = (await req.json()) as {
      eventId?: string;
      requestedAction?: string;
      note?: string;
    };

    if (!eventId || !requestedAction) {
      return NextResponse.json({ error: "eventId and requestedAction are required." }, { status: 400 });
    }
    const trimmedNote = String(note || "").trim();
    if (!trimmedNote) {
      return NextResponse.json({ error: "A short reason is required for access requests." }, { status: 400 });
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

    const { data: eventRow, error: eventErr } = await supabaseAdmin
      .from("events")
      .select("id, user_id")
      .eq("id", eventId)
      .single();
    if (eventErr || !eventRow) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    if (eventRow.user_id === userId) {
      return NextResponse.json({ error: "Owners do not need access requests." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .insert({
        event_id: eventId,
        requester_user_id: userId,
        owner_user_id: eventRow.user_id,
        requested_action: requestedAction,
        note: trimmedNote,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const [{ data: ownerData }, { data: requesterData }, { data: eventData }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(eventRow.user_id),
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin.from("events").select("name").eq("id", eventId).maybeSingle(),
    ]);

    const ownerEmail = ownerData?.user?.email;
    const requesterEmail = requesterData?.user?.email || "unknown";
    const eventName = String(eventData?.name || "your campaign");
    let notifyError: string | null = null;
    if (ownerEmail) {
      const emailResult = await sendTransactionalEmail({
        to: ownerEmail,
        subject: `Access request for ${eventName}`,
        text:
          `A team member requested access for ${eventName}.\n\n` +
          `Requester: ${requesterEmail}\n` +
          `Action: ${requestedAction}\n` +
          `Reason: ${(note || "").trim() || "N/A"}\n\n` +
          `Please review this request in your dashboard.`,
      });
      if (emailResult.sent) {
        await supabaseAdmin
          .from("access_requests")
          .update({ owner_notified_at: new Date().toISOString(), notification_error: null })
          .eq("id", data.id);
      } else {
        notifyError = emailResult.error || "Owner notification failed.";
      }
    } else {
      notifyError = "Owner email missing; notification skipped.";
    }
    if (notifyError) {
      await supabaseAdmin
        .from("access_requests")
        .update({ notification_error: notifyError })
        .eq("id", data.id);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create access request." }, { status: 500 });
  }
}
