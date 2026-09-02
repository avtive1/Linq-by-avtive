import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { createAttendeeCardFromPayload } from "@/lib/services/event.service";
import { assignAttendanceCodeIfMissing } from "@/lib/services/attendance.service";
import { sendVisitorAttendanceCodeEmail } from "@/lib/services/email.service";
import { createRegistrationRequest, isGuestRegistrationTrack } from "@/lib/services/registration.service";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { attendeeRegistrationBodySchema } from "@/lib/validators/registration.validator";
import { enterApiLogContextFromRequest } from "@/lib/request-log-context";
import { logger } from "@/lib/logger-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await enterApiLogContextFromRequest(req);
  try {
    const { id: rawEventId } = await params;
    
    // Resolve event by short_id or UUID
    let event = await queryNeonOne<{ id: string; user_id: string; name: string }>(
      `SELECT id, user_id, name FROM public.events WHERE short_id = $1 LIMIT 1`,
      [rawEventId],
    );
    if (!event && rawEventId.length > 20) {
      event = await queryNeonOne<{ id: string; user_id: string; name: string }>(
        `SELECT id, user_id, name FROM public.events WHERE id = $1 LIMIT 1`,
        [rawEventId],
      );
    }
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const parsed = await parseJsonBody(req, attendeeRegistrationBodySchema);
    if (!parsed.ok) return parsed.response;
    const payload = { ...parsed.data, event_id: event.id };

    const cookieStore = await cookies();
    const authUserId = await getServerUserIdFromCookies(cookieStore);
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const track = String(payload.track || "visitor").trim().toLowerCase();

    // Guest track -> Moderation Queue
    if (isGuestRegistrationTrack(track)) {
      const request = await createRegistrationRequest({
        eventId: event.id,
        userId: authUserId,
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
    }

    // Visitor track -> Direct Card Creation & Pass Generation
    const { data, shareToken } = await createAttendeeCardFromPayload({
      payload,
      authUserId,
      bearerToken,
      forcePublicRegistration: true,
    });

    const createdCardId = String(data?.id || "").trim();
    if (createdCardId) {
      try {
        const attendanceCode = await assignAttendanceCodeIfMissing({
          attendeeId: createdCardId,
          eventId: event.id,
        });
        const attendeeEmail = String(payload.card_email || "").trim();
        if (attendanceCode && attendeeEmail) {
          const emailResult = await sendVisitorAttendanceCodeEmail({
            to: attendeeEmail,
            eventName: String(event.name || "the event"),
            attendanceCode,
            attendeeId: createdCardId,
            eventId: event.id,
          });
          if (!emailResult.queued) {
            logger.warn(
              { attendeeId: createdCardId, eventId: event.id, error: emailResult.error },
              "Visitor attendance code email failed",
            );
          }
        }
      } catch (attendanceErr) {
        logger.warn(
          { err: attendanceErr instanceof Error ? attendanceErr : undefined, attendeeId: createdCardId },
          "Visitor attendance code assignment skipped",
        );
      }
    }

    return NextResponse.json({ data, shareToken }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const status =
      message.includes("already have a pending")
        ? 409
        : message === "Unauthorized"
          ? 401
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
