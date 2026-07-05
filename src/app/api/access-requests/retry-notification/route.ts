import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendBrandedTransactionalEmail } from "@/lib/notifications/branded-email";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  generateAccessRequestDecisionEmailHtml,
  generateAccessRequestOwnerEmailHtml,
} from "@/lib/email-templates/access-request-emails";
import { queryNeonOne } from "@/lib/neon-db";
import { updateTenantRows } from "@/lib/db/tenant-mutations";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";

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
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requestRow = await queryNeonOne<{
      id: string;
      owner_user_id: string;
      requester_user_id: string;
      event_id: string | null;
      requested_action: string;
      note: string | null;
      status: string;
    }>(`SELECT * FROM public.access_requests WHERE id = $1`, [requestId]);
    const reqErr = requestRow ? null : { message: "Access request not found." };
    if (reqErr || !requestRow) {
      return NextResponse.json({ error: "Access request not found." }, { status: 404 });
    }
    if (requestRow.owner_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const [ownerEmail, requesterEmail, eventData] = await Promise.all([
      getAdminUserEmailById(requestRow.owner_user_id),
      getAdminUserEmailById(requestRow.requester_user_id),
      requestRow.event_id
        ? queryNeonOne<{ name: string }>(`SELECT name FROM public.events WHERE id = $1`, [requestRow.event_id])
        : Promise.resolve(null),
    ]);
    const eventName = requestRow.event_id
      ? String(eventData?.name || "your campaign")
      : "Organization Workspace";
    const dashboardUrl = `${getPublicAppUrl()}/dashboard`;

    if (target === "owner") {
      if (!ownerEmail) return NextResponse.json({ error: "Owner email missing." }, { status: 400 });
      const safeRequesterEmail = requesterEmail || "unknown";
      const emailResult = await sendBrandedTransactionalEmail({
        to: ownerEmail,
        subject: `Access request for ${eventName}`,
        text:
          `Hi there,\n\n` +
          `A team member requested access for ${eventName}.\n\n` +
          `Requester: ${safeRequesterEmail}\n` +
          `Action: ${requestRow.requested_action}\n` +
          `Reason: ${requestRow.note || "N/A"}\n\n` +
          `Please review this request in your dashboard:\n${dashboardUrl}`,
        html: generateAccessRequestOwnerEmailHtml({
          eventName,
          requesterEmail: safeRequesterEmail,
          requestedAction: requestRow.requested_action,
          note: requestRow.note || "N/A",
          dashboardUrl,
        }),
      });
      if (!emailResult.sent) {
        await updateTenantRows(
          "access_requests",
          { notification_error: emailResult.error || "Retry failed." },
          { id: requestId },
          requestRow.owner_user_id,
          "id",
        );
        return NextResponse.json({ error: emailResult.error || "Retry failed." }, { status: 500 });
      }
      await updateTenantRows(
        "access_requests",
        { owner_notified_at: new Date().toISOString(), notification_error: null },
        { id: requestId },
        requestRow.owner_user_id,
        "id",
      );
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!requesterEmail) return NextResponse.json({ error: "Requester email missing." }, { status: 400 });
    const decisionLabel = requestRow.status === "approved" ? "approved" : requestRow.status === "rejected" ? "rejected" : "updated";
    const emailResult = await sendBrandedTransactionalEmail({
      to: requesterEmail,
      subject: `Access request ${decisionLabel} for ${eventName}`,
      text:
        `Hi there,\n\n` +
        `Your access request for ${eventName} was ${decisionLabel}.\n\n` +
        `Requested action: ${requestRow.requested_action}\n` +
        `Status: ${String(decisionLabel).toUpperCase()}\n\n` +
        `Check your dashboard for updated capabilities:\n${dashboardUrl}`,
      html: generateAccessRequestDecisionEmailHtml({
        eventName,
        decisionLabel,
        requestedAction: requestRow.requested_action,
        dashboardUrl,
      }),
    });
    if (!emailResult.sent) {
      await updateTenantRows(
        "access_requests",
        { notification_error: emailResult.error || "Retry failed." },
        { id: requestId },
        requestRow.owner_user_id,
        "id",
      );
      return NextResponse.json({ error: emailResult.error || "Retry failed." }, { status: 500 });
    }
    await updateTenantRows(
      "access_requests",
      { requester_notified_at: new Date().toISOString(), notification_error: null },
      { id: requestId },
      requestRow.owner_user_id,
      "id",
    );
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retry notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
