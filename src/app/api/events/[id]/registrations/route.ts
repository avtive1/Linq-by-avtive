import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  countPendingRegistrationsForEvent,
  createRegistrationRequest,
  listPendingRegistrationRequests,
} from "@/lib/services/registration.service";
import {
  emitRegistrationNewToOrg,
  emitRegistrationPendingCountUpdatedToOrg,
} from "@/lib/services/realtime.service";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { isValidUuid } from "@/lib/validation/uuid";
import { queryNeonOne } from "@/lib/neon-db";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    if (!isValidUuid(eventId)) {
      return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const reviewerUserId = await getServerUserIdFromCookies(cookieStore);
    if (!reviewerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    const { requests, total } = await listPendingRegistrationRequests({
      eventId,
      reviewerUserId,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        data: { requests },
        pagination: { limit, offset, total },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch registration requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    if (!isValidUuid(eventId)) {
      return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
    }

    const payload = (await req.json()) as Record<string, unknown>;
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);

    const event = await queryNeonOne<{ user_id: string }>(
      `SELECT user_id FROM public.events WHERE id = $1`,
      [eventId],
    );
    if (!event?.user_id) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const request = await createRegistrationRequest({
      eventId,
      userId,
      attendeeData: payload,
    });

    const { row: summary } = decryptAttendeeSensitiveFields(request.attendee_payload || {});
    const pendingCount = await countPendingRegistrationsForEvent(eventId);

    const realtimePayload = {
      requestId: request.id,
      eventId: request.event_id,
      organizationId: request.organization_id,
      status: request.status,
      request: {
        id: request.id,
        event_id: request.event_id,
        organization_id: request.organization_id,
        status: request.status,
        attendee_name: String(summary.name || ""),
        attendee_company: String(summary.company || ""),
        attendee_email: String(summary.card_email || ""),
        track: String(summary.track || ""),
        created_at: request.created_at,
      },
    };

    await emitRegistrationNewToOrg({
      organizationId: request.organization_id,
      eventId: request.event_id,
      payload: realtimePayload,
    });
    await emitRegistrationPendingCountUpdatedToOrg({
      organizationId: request.organization_id,
      eventId: request.event_id,
      pendingCount,
    });

    return NextResponse.json(
      {
        data: {
          id: request.id,
          status: request.status,
          created_at: request.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create registration request.";
    const status = message.includes("already have a pending") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
