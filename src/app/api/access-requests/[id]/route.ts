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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { decision } = (await req.json()) as { decision?: "approve" | "reject" };
    if (!decision || !["approve", "reject"].includes(decision)) {
      return NextResponse.json({ error: "decision must be approve or reject." }, { status: 400 });
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
    const reviewerId = authData.user?.id;
    if (!reviewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: requestRow, error: reqErr } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (reqErr || !requestRow) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    let canReview = requestRow.owner_user_id === reviewerId;
    if (!canReview) {
      const { data: membership } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("member_user_id", reviewerId)
        .eq("org_owner_user_id", requestRow.owner_user_id)
        .eq("status", "active")
        .maybeSingle();
      canReview = Boolean(membership?.id);
    }
    if (!canReview) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (requestRow.status !== "pending") {
      return NextResponse.json({ error: "Request already reviewed." }, { status: 409 });
    }

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const { error: updateErr } = await supabaseAdmin
      .from("access_requests")
      .update({
        status: nextStatus,
        reviewed_by_user_id: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    if (decision === "approve") {
      const { error: grantErr } = await supabaseAdmin.from("access_grants").insert({
        event_id: requestRow.event_id,
        grantee_user_id: requestRow.requester_user_id,
        granted_by_user_id: reviewerId,
        permission: requestRow.requested_action,
        status: "active",
      });
      if (grantErr && !grantErr.message.toLowerCase().includes("duplicate")) {
        return NextResponse.json({ error: grantErr.message }, { status: 400 });
      }
    }

    const [{ data: requesterData }, { data: eventData }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(requestRow.requester_user_id),
      supabaseAdmin.from("events").select("name").eq("id", requestRow.event_id).maybeSingle(),
    ]);

    const requesterEmail = requesterData?.user?.email;
    const eventName = String(eventData?.name || "your campaign");
    let notifyError: string | null = null;
    if (requesterEmail) {
      const emailResult = await sendTransactionalEmail({
        to: requesterEmail,
        subject: `Access request ${decision} for ${eventName}`,
        text:
          `Your access request for ${eventName} was ${decision}.\n\n` +
          `Requested action: ${requestRow.requested_action}\n` +
          `Status: ${decision.toUpperCase()}\n\n` +
          `Check your dashboard for updated capabilities.`,
      });
      if (emailResult.sent) {
        await supabaseAdmin
          .from("access_requests")
          .update({ requester_notified_at: new Date().toISOString(), notification_error: null })
          .eq("id", id);
      } else {
        notifyError = emailResult.error || "Requester notification failed.";
      }
    } else {
      notifyError = "Requester email missing; notification skipped.";
    }
    if (notifyError) {
      await supabaseAdmin
        .from("access_requests")
        .update({ notification_error: notifyError })
        .eq("id", id);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to review access request." }, { status: 500 });
  }
}
