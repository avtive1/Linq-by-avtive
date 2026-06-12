import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAuthSessionPayloadByUserId } from "@/lib/auth-db";
import { syncOrgMemberAccessGrantsFromTemplate } from "@/lib/organization/sync-org-member-access-grants";
import { ensureOrganizationMemberInviteColumns } from "@/lib/organization/member-invite-db";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { logger } from "@/lib/logger-server";
import { enterApiLogContextFromRequest } from "@/lib/request-log-context";

export async function POST(req: Request) {
  await enterApiLogContextFromRequest(req);
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    await ensureOrganizationMemberInviteColumns();

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await getAuthSessionPayloadByUserId(userId);
    const sessionEmail = String(payload?.email || "").trim().toLowerCase();
    if (!sessionEmail) return NextResponse.json({ error: "Missing session email." }, { status: 400 });

    const body = (await req.json()) as { token?: string };
    const raw = String(body.token || "").trim();
    if (!raw) return NextResponse.json({ error: "token is required." }, { status: 400 });

    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const row = await queryNeonOne<{
      id: string;
      org_owner_user_id: string;
      member_email: string | null;
      role_label: string;
      member_user_id: string | null;
    }>(
      `SELECT id, org_owner_user_id, member_email, role_label, member_user_id
       FROM public.organization_members
       WHERE invite_token_hash = $1
         AND invite_token_expires_at IS NOT NULL
         AND invite_token_expires_at > now()
         AND status = 'active'
       LIMIT 1`,
      [hash],
    );

    if (!row?.id) {
      return NextResponse.json({ error: "Invalid or expired invitation." }, { status: 400 });
    }

    const rowEmail = String(row.member_email || "").trim().toLowerCase();
    if (!rowEmail || rowEmail !== sessionEmail) {
      return NextResponse.json(
        { error: "Signed in as a different email than the invitation. Switch accounts or use the invited email." },
        { status: 403 },
      );
    }

    await queryNeon(
      `UPDATE public.organization_members
       SET member_user_id = $1::uuid,
           invite_token_hash = NULL,
           invite_token_expires_at = NULL,
           updated_at = now()
       WHERE id = $2::uuid`,
      [userId, row.id],
    );

    try {
      await syncOrgMemberAccessGrantsFromTemplate(row.org_owner_user_id, userId, row.role_label);
    } catch (e: unknown) {
      logger.error({ err: e instanceof Error ? e : undefined }, "[accept-invite] grant sync failed");
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to accept invitation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
