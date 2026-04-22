import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { seedViewEventGrantsForOrgMember } from "@/lib/organization/seedViewEventGrants";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { decision, roleLabel, rejectionReason } = (await req.json()) as {
      decision?: "approve" | "reject";
      roleLabel?: string;
      rejectionReason?: string;
    };
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
      .from("organization_join_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (reqErr || !requestRow) return NextResponse.json({ error: "Join request not found." }, { status: 404 });
    if (requestRow.owner_user_id !== reviewerId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestRow.status !== "pending") return NextResponse.json({ error: "Already reviewed." }, { status: 409 });

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const nextRoleLabel = String(roleLabel || "Member").trim() || "Member";
    const nextRejectionReason = String(rejectionReason || "").trim();

    if (decision === "approve") {
      const { data: existingMembership } = await supabaseAdmin
        .from("organization_members")
        .select("id, org_owner_user_id")
        .eq("member_user_id", requestRow.requester_user_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (
        existingMembership?.id &&
        existingMembership.org_owner_user_id !== requestRow.owner_user_id
      ) {
        return NextResponse.json(
          { error: "Requester is already an active member of another organization." },
          { status: 409 },
        );
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from("organization_join_requests")
      .update({
        status: nextStatus,
        reviewed_by_user_id: reviewerId,
        reviewed_at: new Date().toISOString(),
        reapply_after:
          decision === "reject"
            ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            : null,
        rejection_reason: decision === "reject" ? (nextRejectionReason || null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    let requesterEmail = "";

    if (decision === "approve") {
      // Fetch email to satisfy the unique constraint (org_owner_user_id, member_email)
      const { data: requesterUser } = await supabaseAdmin.auth.admin.getUserById(requestRow.requester_user_id);
      requesterEmail = requesterUser?.user?.email || "";

      const { error: memberErr } = await supabaseAdmin.from("organization_members").upsert(
        {
          org_owner_user_id: requestRow.owner_user_id,
          member_user_id: requestRow.requester_user_id,
          member_email: requesterEmail.toLowerCase(),
          role_label: nextRoleLabel,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_owner_user_id,member_email" },
      );
      if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 400 });

      try {
        await seedViewEventGrantsForOrgMember(supabaseAdmin, requestRow.owner_user_id, requestRow.requester_user_id);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Failed to seed default viewer access." }, { status: 400 });
      }
    } else {
      const { data: requesterUser } = await supabaseAdmin.auth.admin.getUserById(requestRow.requester_user_id);
      requesterEmail = requesterUser?.user?.email || "";
    }

    if (requesterEmail) {
      await sendTransactionalEmail({
        to: requesterEmail,
        subject: `Organization join request ${nextStatus}`,
        text:
          `Your request to join organization "${requestRow.requested_org_name}" was ${nextStatus}.\n\n` +
          (nextStatus === "approved"
            ? "You can now continue in the dashboard as an organization member."
            : "If this seems incorrect, contact your organization admin."),
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to review join request." }, { status: 500 });
  }
}
