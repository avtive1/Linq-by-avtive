import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createRegistrationRequest,
  listPendingRegistrationRequests,
} from "@/lib/services/registration.service";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { isValidUuid } from "@/lib/validation/uuid";
import { queryNeonOne } from "@/lib/neon-db";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { attendeeRegistrationBodySchema } from "@/lib/validators/registration.validator";

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

    const parsed = await parseJsonBody(req, attendeeRegistrationBodySchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data as Record<string, unknown> & {
    track?: unknown;
    card_email?: unknown;
    };
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
