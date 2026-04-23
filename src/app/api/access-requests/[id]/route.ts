import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { insertRow, queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";
import { getServerAuthSession } from "@/auth";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }
    const { decision } = (await req.json()) as { decision?: "approve" | "reject" };
    if (!decision || !["approve", "reject"].includes(decision)) {
      return NextResponse.json({ error: "decision must be approve or reject." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const reviewerId = await getServerUserIdFromCookies(cookieStore);
    if (!reviewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await getServerAuthSession();
    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const sessionRole = String(session?.user?.role || "").toLowerCase();
    const sessionEmail = String(session?.user?.email || "").toLowerCase().trim();
    const isAdminReviewer =
      sessionRole === "admin" || Boolean(sessionEmail && adminEmails.includes(sessionEmail));

    const requestRow = await queryNeonOne<{
      id: string;
      event_id: string | null;
      requester_user_id: string;
      owner_user_id: string;
      requested_action: string;
      status: string;
    }>(`SELECT * FROM public.access_requests WHERE id = $1`, [id]);
    const reqErr = requestRow ? null : { message: "Request not found." };
    if (reqErr || !requestRow) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    const canReview = requestRow.owner_user_id === reviewerId || isAdminReviewer;
    if (!canReview) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (requestRow.status !== "pending") {
      return NextResponse.json({ error: "Request already reviewed." }, { status: 409 });
    }

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const updatedRequests = await updateRows(
      "access_requests",
      {
        status: nextStatus,
        reviewed_by_user_id: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { id },
      "id",
    );
    const updateErr = updatedRequests.length ? null : { message: "Failed to update request." };
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    if (decision === "approve") {
      try {
        await insertRow("access_grants", {
          event_id: requestRow.event_id,
          grantee_user_id: requestRow.requester_user_id,
          granted_by_user_id: reviewerId,
          permission: requestRow.requested_action,
          status: "active",
        });
      } catch (error: unknown) {
        const isUniqueViolation =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          String((error as { code?: string }).code) === "23505";
        if (!isUniqueViolation) {
          const message = error instanceof Error ? error.message : "Failed to create access grant.";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }
    }

    const [requesterEmail, eventData] = await Promise.all([
      getAdminUserEmailById(requestRow.requester_user_id),
      requestRow.event_id
        ? queryNeonOne<{ name: string }>(`SELECT name FROM public.events WHERE id = $1`, [requestRow.event_id])
        : Promise.resolve(null),
    ]);
    const eventName = requestRow.event_id 
      ? String(eventData?.name || "your campaign")
      : "Organization Workspace";
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
        await updateRows(
          "access_requests",
          { requester_notified_at: new Date().toISOString(), notification_error: null },
          { id },
          "id",
        );
      } else {
        notifyError = emailResult.error || "Requester notification failed.";
      }
    } else {
      notifyError = "Requester email missing; notification skipped.";
    }
    if (notifyError) {
      await updateRows("access_requests", { notification_error: notifyError }, { id }, "id");
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to review access request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
