import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";
import { insertRow, queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";

async function getCurrentUserId() {
  const cookieStore = await cookies();
  return getServerUserIdFromCookies(cookieStore);
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { organizationName } = (await req.json()) as { organizationName?: string };
    const requestedOrgName = normalizeOrganizationName(String(organizationName || ""));
    const requestedOrgKey = toOrganizationKey(requestedOrgName);
    if (!requestedOrgName) {
      return NextResponse.json({ error: "organizationName is required." }, { status: 400 });
    }
    if (!requestedOrgKey) {
      return NextResponse.json({ error: "organizationName is invalid." }, { status: 400 });
    }

    const alreadyMember = await queryNeonOne<{ id: string }>(
      `SELECT id
       FROM public.organization_members
       WHERE member_user_id = $1
         AND status = 'active'
       LIMIT 1`,
      [userId],
    );
    if (alreadyMember?.id) {
      return NextResponse.json({ data: { status: "already_member" } }, { status: 200 });
    }

    const [selfOwnedEvents, selfOwnedMembers] = await Promise.all([
      queryNeon<{ id: string }>(`SELECT id FROM public.events WHERE user_id = $1 LIMIT 1`, [userId]),
      queryNeon<{ id: string }>(
        `SELECT id FROM public.organization_members WHERE org_owner_user_id = $1 LIMIT 1`,
        [userId],
      ),
    ]);
    if ((selfOwnedEvents || []).length > 0 || (selfOwnedMembers || []).length > 0) {
      return NextResponse.json({ data: { status: "owner_context" } }, { status: 200 });
    }

    let selectedOwnerId = "";
    const existingOrg = await queryNeonOne<{ owner_user_id: string; organization_name: string }>(
      `SELECT owner_user_id, organization_name
       FROM public.organizations
       WHERE organization_name_key = $1
       LIMIT 1`,
      [requestedOrgKey],
    );

    if (existingOrg?.owner_user_id) {
      selectedOwnerId = existingOrg.owner_user_id;
    } else {
      // Owner assignment is explicit (founder-assigned), never auto-selected from first signup/profile.
      return NextResponse.json({ data: { status: "no_owner_found" } }, { status: 200 });
    }

    if (!selectedOwnerId) {
      return NextResponse.json({ data: { status: "no_owner_found" } }, { status: 200 });
    }
    if (selectedOwnerId === userId) {
      return NextResponse.json({ data: { status: "owner_context" } }, { status: 200 });
    }

    const existingPending = await queryNeonOne<{ id: string; owner_user_id: string }>(
      `SELECT id, owner_user_id
       FROM public.organization_join_requests
       WHERE requester_user_id = $1
         AND status = 'pending'
       LIMIT 1`,
      [userId],
    );
    if (existingPending?.id) {
      return NextResponse.json(
        {
          data: {
            status: "pending_exists",
            requestId: existingPending.id,
            ownerUserId: existingPending.owner_user_id,
          },
        },
        { status: 200 },
      );
    }

    const cooldownRequest = await queryNeonOne<{ id: string; reapply_after: string }>(
      `SELECT id, reapply_after
       FROM public.organization_join_requests
       WHERE requester_user_id = $1
         AND owner_user_id = $2
         AND status = 'rejected'
         AND reapply_after IS NOT NULL
         AND reapply_after > $3
       ORDER BY reapply_after DESC
       LIMIT 1`,
      [userId, selectedOwnerId, new Date().toISOString()],
    );
    if (cooldownRequest?.id) {
      return NextResponse.json(
        {
          data: {
            status: "reapply_later",
            requestId: cooldownRequest.id,
            reapplyAfter: cooldownRequest.reapply_after,
          },
        },
        { status: 200 },
      );
    }

    const data = await insertRow(
      "organization_join_requests",
      {
        requester_user_id: userId,
        owner_user_id: selectedOwnerId,
        requested_org_name: requestedOrgName,
        status: "pending",
        reapply_after: null,
        rejection_reason: null,
      },
      "id, status",
    );
    if (!data?.id) return NextResponse.json({ error: "Failed to create join request." }, { status: 400 });

    const [ownerEmail, requesterEmail] = await Promise.all([
      getAdminUserEmailById(selectedOwnerId),
      getAdminUserEmailById(userId),
    ]);

    if (ownerEmail) {
      await sendTransactionalEmail({
        to: ownerEmail,
        subject: `Organization verification request (${requestedOrgName})`,
        text:
          `A user requested to join your organization: ${requestedOrgName}.\n\n` +
          `Requester email: ${requesterEmail || "unknown"}\n` +
          `Join request ID: ${String(data.id)}\n\n` +
          `Please review this request in your dashboard inbox.`,
      });
    }

    return NextResponse.json({ data: { status: "created", requestId: String(data.id) } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create join request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
