import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { updateAccessGrantForTenant } from "@/lib/db/tenant-mutations";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";

const ORG_MANAGED_PERMISSIONS = ["create_event", "manage_event", "edit_cards", "delete_cards"] as const;

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid grant id." }, { status: 400 });
    }
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const grantRow = await queryNeonOne<{
      id: string;
      event_id: string | null;
      granted_by_user_id: string;
      grantee_user_id: string;
      permission: string;
    }>(
      `SELECT id, event_id, granted_by_user_id, grantee_user_id, permission
       FROM public.access_grants
       WHERE id = $1`,
      [id],
    );
    const grantErr = grantRow ? null : { message: "Grant not found" };
    if (grantErr || !grantRow) return NextResponse.json({ error: "Grant not found." }, { status: 404 });

    let ownerIdForScope = userId;
    if (grantRow.event_id) {
      const eventRow = await queryNeonOne<{ user_id: string | null }>(
        `SELECT user_id FROM public.events WHERE id = $1`,
        [grantRow.event_id],
      );
      const eventErr = eventRow ? null : { message: "Event not found" };
      if (eventErr || !eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
      if (eventRow.user_id !== userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      ownerIdForScope = String(eventRow.user_id || userId);
    } else if (grantRow.granted_by_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const updatedAt = new Date().toISOString();
    const shouldRevokeOrgScope = ORG_MANAGED_PERMISSIONS.includes(
      grantRow.permission as (typeof ORG_MANAGED_PERMISSIONS)[number],
    );
    if (shouldRevokeOrgScope) {
      await queryNeon(
        `UPDATE public.access_grants
         SET status = 'revoked', updated_at = $1
         WHERE status = 'active'
           AND grantee_user_id = $2
           AND permission = $3
           AND (
             event_id IN (SELECT id FROM public.events WHERE user_id = $4)
             OR (event_id IS NULL AND granted_by_user_id = $4)
           )`,
        [updatedAt, grantRow.grantee_user_id, grantRow.permission, ownerIdForScope],
      );
    } else if (grantRow.event_id) {
      await queryNeon(
        `UPDATE public.access_grants
         SET status = 'revoked', updated_at = $1
         WHERE status = 'active'
           AND event_id = $2
           AND grantee_user_id = $3
           AND permission = $4`,
        [updatedAt, grantRow.event_id, grantRow.grantee_user_id, grantRow.permission],
      );
    } else {
      await queryNeon(
        `UPDATE public.access_grants
         SET status = 'revoked', updated_at = $1
         WHERE status = 'active'
           AND event_id IS NULL
           AND granted_by_user_id = $2
           AND grantee_user_id = $3
           AND permission = $4`,
        [updatedAt, userId, grantRow.grantee_user_id, grantRow.permission],
      );
    }

    await updateAccessGrantForTenant(
      id,
      ownerIdForScope,
      { status: "revoked", updated_at: updatedAt },
      "id",
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to revoke grant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
