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

export async function POST(req: Request) {
  try {
    const { requestId, target } = (await req.json()) as {
      requestId?: string;
      target?: "owner" | "requester";
    };
    if (!requestId || !target) {
      return NextResponse.json({ error: "requestId and target are required." }, { status: 400 });
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
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: requestRow, error: reqErr } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (reqErr || !requestRow) {
      return NextResponse.json({ error: "Access request not found." }, { status: 404 });
    }
    if (requestRow.owner_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const [{ data: ownerData }, { data: requesterData }, { data: eventData }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(requestRow.owner_user_id),
      supabaseAdmin.auth.admin.getUserById(requestRow.requester_user_id),
      supabaseAdmin.from("events").select("name").eq("id", requestRow.event_id).maybeSingle(),
    ]);

    const ownerEmail = ownerData?.user?.email;
    const requesterEmail = requesterData?.user?.email;
    const eventName = String(eventData?.name || "your campaign");

    if (target === "owner") {
      if (!ownerEmail) return NextResponse.json({ error: "Owner email missing." }, { status: 400 });
      const emailResult = await sendTransactionalEmail({
        to: ownerEmail,
        subject: `Access request for ${eventName}`,
        text:
          `A team member requested access for ${eventName}.\n\n` +
          `Requester: ${requesterEmail || "unknown"}\n` +
          `Action: ${requestRow.requested_action}\n` +
          `Reason: ${requestRow.note || "N/A"}\n\n` +
          `Please review this request in your dashboard.`,
      });
      if (!emailResult.sent) {
        await supabaseAdmin.from("access_requests").update({ notification_error: emailResult.error || "Retry failed." }).eq("id", requestId);
        return NextResponse.json({ error: emailResult.error || "Retry failed." }, { status: 500 });
      }
      await supabaseAdmin
        .from("access_requests")
        .update({ owner_notified_at: new Date().toISOString(), notification_error: null })
        .eq("id", requestId);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!requesterEmail) return NextResponse.json({ error: "Requester email missing." }, { status: 400 });
    const decisionLabel = requestRow.status === "approved" ? "approved" : requestRow.status === "rejected" ? "rejected" : "updated";
    const emailResult = await sendTransactionalEmail({
      to: requesterEmail,
      subject: `Access request ${decisionLabel} for ${eventName}`,
      text:
        `Your access request for ${eventName} was ${decisionLabel}.\n\n` +
        `Requested action: ${requestRow.requested_action}\n` +
        `Status: ${String(decisionLabel).toUpperCase()}\n\n` +
        `Check your dashboard for updated capabilities.`,
    });
    if (!emailResult.sent) {
      await supabaseAdmin.from("access_requests").update({ notification_error: emailResult.error || "Retry failed." }).eq("id", requestId);
      return NextResponse.json({ error: emailResult.error || "Retry failed." }, { status: 500 });
    }
    await supabaseAdmin
      .from("access_requests")
      .update({ requester_notified_at: new Date().toISOString(), notification_error: null })
      .eq("id", requestId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to retry notification." }, { status: 500 });
  }
}
