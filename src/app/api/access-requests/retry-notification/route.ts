import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { queryNeonOne, updateRows } from "@/lib/neon-db";
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

    if (target === "owner") {
      if (!ownerEmail) return NextResponse.json({ error: "Owner email missing." }, { status: 400 });
      const emailResult = await sendTransactionalEmail({
        to: ownerEmail,
        subject: `Access request for ${eventName}`,
        text:
          `A team member requested access for ${eventName}.\n\n` +
          `Requester: ${requesterEmail || "unknown"}\n` +
          `Action: ${requestRow.requested_action}\n` +
          `Reason: ${requestRow.note || "N/A"}\n\n` +
          `Please review this request in your dashboard.`,
      });
      if (!emailResult.sent) {
        await updateRows(
          "access_requests",
          { notification_error: emailResult.error || "Retry failed." },
          { id: requestId },
          "id",
        );
        return NextResponse.json({ error: emailResult.error || "Retry failed." }, { status: 500 });
      }
      await updateRows(
        "access_requests",
        { owner_notified_at: new Date().toISOString(), notification_error: null },
        { id: requestId },
        "id",
      );
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!requesterEmail) return NextResponse.json({ error: "Requester email missing." }, { status: 400 });
    const decisionLabel = requestRow.status === "approved" ? "approved" : requestRow.status === "rejected" ? "rejected" : "updated";
    const emailResult = await sendTransactionalEmail({
      to: requesterEmail,
      subject: `Access request ${decisionLabel} for ${eventName}`,
      text:
        `Your access request for ${eventName} was ${decisionLabel}.\n\n` +
        `Requested action: ${requestRow.requested_action}\n` +
        `Status: ${String(decisionLabel).toUpperCase()}\n\n` +
        `Check your dashboard for updated capabilities.`,
    });
    if (!emailResult.sent) {
      await updateRows(
        "access_requests",
        { notification_error: emailResult.error || "Retry failed." },
        { id: requestId },
        "id",
      );
      return NextResponse.json({ error: emailResult.error || "Retry failed." }, { status: 500 });
    }
    await updateRows(
      "access_requests",
      { requester_notified_at: new Date().toISOString(), notification_error: null },
      { id: requestId },
      "id",
    );
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retry notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
