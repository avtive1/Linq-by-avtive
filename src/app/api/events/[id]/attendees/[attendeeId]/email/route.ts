import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeonOne } from "@/lib/neon-db";
import { getServerAuthSession } from "@/auth";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { isValidUuid } from "@/lib/validation/uuid";
import { apiRouteErrorResponse, isApiUnauthorizedError, withApiTenantContext } from "@/lib/tenant/api-context";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { sendCustomAttendeeEmail } from "@/lib/services/email.service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; attendeeId: string }> },
) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) {
      return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });
    }

    const { id: eventId, attendeeId } = await params;
    if (!isValidUuid(eventId) || !isValidUuid(attendeeId)) {
      return NextResponse.json({ error: "Invalid event or attendee id." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { subject, body: emailBody } = body;
    if (typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    if (typeof emailBody !== "string" || !emailBody.trim()) {
      return NextResponse.json({ error: "Email body is required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const viewerUserId = await getServerUserIdFromCookies(cookieStore);
    if (!viewerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return withApiTenantContext(cookieStore, async () => {
      const event = await queryNeonOne<{ user_id: string | null }>(
        `SELECT user_id FROM public.events WHERE id = $1`,
        [eventId],
      );
      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      const attendeeRow = await queryNeonOne<Record<string, unknown>>(
        `SELECT * FROM public.attendees WHERE id = $1 AND event_id = $2`,
        [attendeeId, eventId],
      );
      if (!attendeeRow) {
        return NextResponse.json({ error: "Attendee not found." }, { status: 404 });
      }

      const ownsEvent = Boolean(event && event.user_id === viewerUserId);
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

      if (!ownsEvent && !isAdmin && !isOrgTeamViewer) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { row: secure } = decryptAttendeeSensitiveFields(attendeeRow);
      const toEmail = String(secure.card_email || "").trim();
      if (!toEmail) {
        return NextResponse.json({ error: "Attendee does not have a valid email address." }, { status: 400 });
      }

      const sendResult = await sendCustomAttendeeEmail({
        to: toEmail,
        subject: subject.trim(),
        body: emailBody.trim(),
      });

      if (!sendResult.sent) {
        return NextResponse.json({ error: sendResult.error || "Failed to send email." }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }, { allowAdminBypass: true });
  } catch (error: unknown) {
    if (isApiUnauthorizedError(error)) {
      return apiRouteErrorResponse(error, "Unauthorized");
    }
    const message = error instanceof Error ? error.message : "Failed to send custom email.";
    logSecurityEvent({
      event: "security.event_attendees.send_custom_email_failed",
      level: "error",
      details: { reason: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
