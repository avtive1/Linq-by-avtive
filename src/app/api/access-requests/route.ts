import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { insertRow, queryNeon, queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserEmailById } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventRow = await queryNeonOne<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM public.events WHERE id = $1`,
      [eventId],
    );
    const eventErr = eventRow ? null : { message: "Event not found." };
    if (eventErr || !eventRow) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const isEventOwner = eventRow.user_id === userId;
    let isOrgAdminReviewer = false;
    if (!isEventOwner) {
      const membership = await queryNeonOne<{ id: string }>(
        `SELECT id
         FROM public.organization_members
         WHERE member_user_id = $1
           AND org_owner_user_id = $2
           AND status = 'active'
         LIMIT 1`,
        [userId, eventRow.user_id],
      );
      isOrgAdminReviewer = Boolean(membership?.id);
    }

    if (!isEventOwner && !isOrgAdminReviewer) {
      return NextResponse.json({ data: { requests: [] } }, { status: 200 });
    }

    const requests = await queryNeon<{
      id: string;
      requester_user_id: string;
      requested_action: string;
      note: string | null;
      status: string;
      created_at: string;
    }>(
      `SELECT id, requester_user_id, requested_action, note, status, created_at
       FROM public.access_requests
       WHERE event_id = $1
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT $2
       OFFSET $3`,
      [eventId, limit, offset],
    );
    const countRow = await queryNeonOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM public.access_requests
       WHERE event_id = $1
         AND status = 'pending'`,
      [eventId],
    );
    const requesterIds = Array.from(new Set(requests.map((r) => r.requester_user_id)));
    const requesterEmailRows = requesterIds.length
      ? await queryNeon<{ user_id: string; email: string }>(
          `SELECT user_id, email
           FROM public.auth_users
           WHERE user_id = ANY($1::uuid[])`,
          [requesterIds],
        )
      : [];
    const requesterEmailById = new Map(requesterEmailRows.map((r) => [r.user_id, r.email]));

    const enriched = requests.map((r) => ({
      ...r,
      requester_email: requesterEmailById.get(r.requester_user_id) || "unknown",
    }));

    return NextResponse.json(
      {
        data: { requests: enriched },
        pagination: {
          limit,
          offset,
          total: Number(countRow?.count || 0),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch access requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { eventId, ownerId, requestedAction, note } = (await req.json()) as {
      eventId?: string;
      ownerId?: string;
      requestedAction?: string;
      note?: string;
    };

    if ((!eventId && !ownerId) || !requestedAction) {
      return NextResponse.json({ error: "Either eventId or ownerId, and requestedAction are required." }, { status: 400 });
    }
    const trimmedNote = String(note || "").trim();
    if (!trimmedNote) {
      return NextResponse.json({ error: "A short reason is required for access requests." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let finalOwnerId = ownerId;
    let eventName = "Organization Level Access";

    if (eventId) {
      const eventRow = await queryNeonOne<{ id: string; user_id: string; name: string }>(
        `SELECT id, user_id, name FROM public.events WHERE id = $1`,
        [eventId],
      );
      const eventErr = eventRow ? null : { message: "Event not found." };
      if (eventErr || !eventRow) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }
      finalOwnerId = eventRow.user_id;
      eventName = eventRow.name;
    }

    if (!finalOwnerId) {
      return NextResponse.json({ error: "ownerId could not be determined." }, { status: 400 });
    }

    if (finalOwnerId === userId) {
      return NextResponse.json({ error: "Owners do not need access requests." }, { status: 400 });
    }

    let data: Record<string, unknown> | null = null;
    try {
      data = await insertRow(
        "access_requests",
        {
          event_id: eventId || null,
          requester_user_id: userId,
          owner_user_id: finalOwnerId,
          requested_action: requestedAction,
          note: trimmedNote,
          status: "pending",
        },
        "id",
      );
    } catch (error: unknown) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        String((error as { code?: string }).code) === "23505";
      if (isUniqueViolation) {
        return NextResponse.json({ error: "You already have a pending request for this action." }, { status: 409 });
      }
      const message = error instanceof Error ? error.message : "Failed to create access request.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!data?.id) {
      return NextResponse.json({ error: "Failed to create access request." }, { status: 400 });
    }

    const requestId = String(data.id);

    const [ownerEmail, requesterEmail] = await Promise.all([
      getAdminUserEmailById(finalOwnerId),
      getAdminUserEmailById(userId),
    ]);
    const safeRequesterEmail = requesterEmail || "unknown";
    let notifyError: string | null = null;
    if (ownerEmail) {
      const emailResult = await sendTransactionalEmail({
        to: ownerEmail,
        subject: `Access request for ${eventName}`,
        text:
          `A team member requested access for ${eventName}.\n\n` +
          `Requester: ${safeRequesterEmail}\n` +
          `Action: ${requestedAction}\n` +
          `Reason: ${(note || "").trim() || "N/A"}\n\n` +
          `Please review this request in your dashboard.`,
      });
      if (emailResult.sent) {
        await updateRows(
          "access_requests",
          { owner_notified_at: new Date().toISOString(), notification_error: null },
          { id: requestId },
          "id",
        );
      } else {
        notifyError = emailResult.error || "Owner notification failed.";
      }
    } else {
      notifyError = "Owner email missing; notification skipped.";
    }
    if (notifyError) {
      await updateRows(
        "access_requests",
        { notification_error: notifyError },
        { id: requestId },
        "id",
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create access request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
