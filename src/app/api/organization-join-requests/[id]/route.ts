import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { seedViewEventGrantsForOrgMember } from "@/lib/organization/seedViewEventGrants";
import { queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";
import { isValidUuid } from "@/lib/validation/uuid";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }
    const { decision, roleLabel, rejectionReason } = (await req.json()) as {
      decision?: "approve" | "reject";
      roleLabel?: string;
      rejectionReason?: string;
    };
    if (!decision || !["approve", "reject"].includes(decision)) {
      return NextResponse.json({ error: "decision must be approve or reject." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const reviewerId = await getServerUserIdFromCookies(cookieStore);
    if (!reviewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requestRow = await queryNeonOne<{
      id: string;
      requester_user_id: string;
      owner_user_id: string;
      requested_org_name: string;
      status: string;
    }>(`SELECT * FROM public.organization_join_requests WHERE id = $1`, [id]);
    const reqErr = requestRow ? null : { message: "Join request not found." };
    if (reqErr || !requestRow) return NextResponse.json({ error: "Join request not found." }, { status: 404 });
    if (requestRow.owner_user_id !== reviewerId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestRow.status !== "pending") return NextResponse.json({ error: "Already reviewed." }, { status: 409 });

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const nextRoleLabel = String(roleLabel || "Member").trim() || "Member";
    const nextRejectionReason = String(rejectionReason || "").trim();

    if (decision === "approve") {
      const existingMembership = await queryNeonOne<{ id: string; org_owner_user_id: string }>(
        `SELECT id, org_owner_user_id
         FROM public.organization_members
         WHERE member_user_id = $1
           AND status = 'active'
         LIMIT 1`,
        [requestRow.requester_user_id],
      );

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

    const updatedJoinRequests = await updateRows(
      "organization_join_requests",
      {
        status: nextStatus,
        reviewed_by_user_id: reviewerId,
        reviewed_at: new Date().toISOString(),
        reapply_after: decision === "reject" ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null,
        rejection_reason: decision === "reject" ? (nextRejectionReason || null) : null,
        updated_at: new Date().toISOString(),
      },
      { id },
      "id",
    );
    const updateErr = updatedJoinRequests.length ? null : { message: "Failed to update join request." };
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    let requesterEmail = "";

    if (decision === "approve") {
      // Fetch email to satisfy the unique constraint (org_owner_user_id, member_email)
      requesterEmail = (await getAdminUserEmailById(requestRow.requester_user_id)) || "";
      const timestamp = new Date().toISOString();
      const normalizedRequesterEmail = requesterEmail.toLowerCase();
      const existingMemberRow = await queryNeonOne<{ id: string }>(
        `SELECT id
         FROM public.organization_members
         WHERE org_owner_user_id = $1
           AND lower(member_email) = lower($2)
         LIMIT 1`,
        [requestRow.owner_user_id, normalizedRequesterEmail],
      );
      if (existingMemberRow?.id) {
        await queryNeonOne(
          `UPDATE public.organization_members
           SET member_user_id = $1,
               role_label = $2,
               status = 'active',
               updated_at = $3
           WHERE id = $4
           RETURNING id`,
          [requestRow.requester_user_id, nextRoleLabel, timestamp, existingMemberRow.id],
        );
      } else {
        await queryNeonOne(
          `INSERT INTO public.organization_members
           (org_owner_user_id, member_user_id, member_email, role_label, status, updated_at)
           VALUES ($1, $2, $3, $4, 'active', $5)
           RETURNING id`,
          [
            requestRow.owner_user_id,
            requestRow.requester_user_id,
            normalizedRequesterEmail,
            nextRoleLabel,
            timestamp,
          ],
        );
      }

      try {
        await seedViewEventGrantsForOrgMember(requestRow.owner_user_id, requestRow.requester_user_id);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to seed default viewer access.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    } else {
      requesterEmail = (await getAdminUserEmailById(requestRow.requester_user_id)) || "";
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to review join request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
