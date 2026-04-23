import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerAuthSession } from "@/auth";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { queryNeon, queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { isValidUuid } from "@/lib/validation/uuid";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
    const cookieStore = await cookies();
    const viewerUserId = await getServerUserIdFromCookies(cookieStore);
    if (!viewerUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await getServerAuthSession();

    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role = String(session?.user?.role || "");
    const isAdminByRole = typeof role === "string" && role.toLowerCase() === "admin";
    const isAdminByEmail = Boolean(
      session?.user?.email &&
        adminEmails.includes(session.user.email.toLowerCase()),
    );
    const isAdmin = isAdminByRole || isAdminByEmail;

    const requestUrl = new URL(req.url);
    const impersonateId = requestUrl.searchParams.get("impersonate");

    const event = await queryNeonOne<{ user_id: string | null }>(
      `SELECT user_id FROM public.events WHERE id = $1`,
      [id],
    );
    const ownsEvent = Boolean(event && event.user_id === viewerUserId);
    const canPreviewAsOrg = Boolean(
      event && isAdmin && impersonateId && event.user_id === impersonateId,
    );

    let isOrgTeamViewer = false;
    if (event?.user_id) {
      const membership = await queryNeonOne<{ id: string }>(
        `SELECT id
         FROM public.organization_members
         WHERE member_user_id = $1
           AND org_owner_user_id = $2
           AND status = 'active'
         LIMIT 1`,
        [viewerUserId, event.user_id],
      );
      isOrgTeamViewer = Boolean(membership?.id);
    }

    // Active organization team members can view attendees by default.
    // Edit/delete remains separately permission-gated in UI and other APIs.
    if (!event || (!ownsEvent && !canPreviewAsOrg && !isOrgTeamViewer)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await queryNeon<Record<string, unknown>>(
      `SELECT * FROM public.attendees WHERE event_id = $1 ORDER BY created_at DESC`,
      [id],
    );

    const decrypted: Array<Record<string, unknown>> = [];
    for (const row of data || []) {
      const { row: secure, migrationPatch } = decryptAttendeeSensitiveFields(row);
      if (Object.keys(migrationPatch).length > 0 && row.id) {
        try {
          await updateRows("attendees", migrationPatch, { id: row.id as string }, "id");
        } catch (migrationError: unknown) {
          const migrationMessage =
            migrationError instanceof Error ? migrationError.message : "Failed to persist attendee migration patch.";
          logSecurityEvent({
            event: "security.event_attendees.migration_write_failed",
            level: "error",
            actorId: viewerUserId,
            resourceId: String(row.id),
            details: { reason: migrationMessage },
          });
          return NextResponse.json({ error: "Failed to process attendee records." }, { status: 500 });
        }
      }
      decrypted.push(secure);
    }

    return NextResponse.json({ data: decrypted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    logSecurityEvent({
      event: "security.event_attendees.fetch_failed",
      level: "error",
      details: { reason: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
