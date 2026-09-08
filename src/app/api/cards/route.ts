import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { createAttendeeCardFromPayload } from "@/lib/services/event.service";
import { assignAttendanceCodeIfMissing } from "@/lib/services/attendance.service";
import { sendVisitorAttendanceCodeEmail } from "@/lib/services/email.service";
import { isGuestRegistrationTrack } from "@/lib/services/registration.service";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { attendeeRegistrationBodySchema } from "@/lib/validators/registration.validator";
import { validateAndNormalizeLinkedInUrl, validateAttendeeSocialLinks } from "@/lib/validation/social-urls";
import { enterApiLogContextFromRequest } from "@/lib/request-log-context";
import { logger } from "@/lib/logger-server";

export async function POST(req: Request) {
  await enterApiLogContextFromRequest(req);
  try {
    const parsed = await parseJsonBody(req, attendeeRegistrationBodySchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data as Record<string, unknown>;

    const rawLinkedin = payload.linkedin;
    const validatedLinkedin = validateAndNormalizeLinkedInUrl(rawLinkedin);
    if (!validatedLinkedin.ok) {
      return NextResponse.json({ error: validatedLinkedin.error }, { status: 400 });
    }
    payload.linkedin = validatedLinkedin.url;

    if (payload.social_links) {
      const validatedSocial = validateAttendeeSocialLinks(payload.social_links);
      if (!validatedSocial.ok) {
        return NextResponse.json({ error: validatedSocial.error }, { status: 400 });
      }
      const customFields =
        payload.custom_fields && typeof payload.custom_fields === "object" && !Array.isArray(payload.custom_fields)
          ? { ...(payload.custom_fields as Record<string, unknown>) }
          : {};
      customFields.social_links = validatedSocial.socialLinks;
      payload.custom_fields = customFields;
      delete payload.social_links;
    }
    const cookieStore = await cookies();
    const authUserId = await getServerUserIdFromCookies(cookieStore);
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const { data, shareToken } = await createAttendeeCardFromPayload({
      payload,
      authUserId,
      bearerToken,
    });

    const createdCardId = String(data?.id || "").trim();
    const eventId = String(payload.event_id || "").trim();
    const track = String(payload.track || "visitor").trim().toLowerCase();
    if (createdCardId && eventId && !isGuestRegistrationTrack(track)) {
      try {
        const attendanceCode = await assignAttendanceCodeIfMissing({
          attendeeId: createdCardId,
          eventId,
        });
        const attendeeEmail = String(payload.card_email || "").trim();
        if (attendanceCode && attendeeEmail) {
          const eventRow = await queryNeonOne<{ name: string }>(
            `SELECT name FROM public.events WHERE id = $1`,
            [eventId],
          );
          const emailResult = await sendVisitorAttendanceCodeEmail({
            to: attendeeEmail,
            eventName: String(eventRow?.name || "the event"),
            attendanceCode,
            attendeeId: createdCardId,
            cardId: createdCardId,
            shareToken,
            eventId,
            attendeeName: typeof payload.name === "string" ? payload.name : undefined,
            role: typeof payload.role === "string" ? payload.role : undefined,
            company: typeof payload.company === "string" ? payload.company : undefined,
          });
          if (!emailResult.queued) {
            logger.warn(
              { attendeeId: createdCardId, eventId, error: emailResult.error },
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

    return NextResponse.json({ data, shareToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
