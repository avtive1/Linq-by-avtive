import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { markAttendeeAttended } from "@/lib/services/attendance.service";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { markAttendanceBodySchema } from "@/lib/validators/registration.validator";
import { apiRouteErrorResponse, isApiUnauthorizedError, withApiTenantContext } from "@/lib/tenant/api-context";

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

    const parsed = await parseJsonBody(req, markAttendanceBodySchema);
    if (!parsed.ok) return parsed.response;

    const cookieStore = await cookies();
    const ownerUserId = await getServerUserIdFromCookies(cookieStore);
    if (!ownerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return withApiTenantContext(cookieStore, async () => {
      let result;
      try {
        result = await markAttendeeAttended({
          eventId,
          attendeeId,
          code: parsed.data.code,
          ownerUserId,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to mark attendance.";
        const status =
          message === "Forbidden."
            ? 403
            : message === "Attendee not found."
              ? 404
              : 400;
        return NextResponse.json({ error: message }, { status });
      }

      return NextResponse.json(
        {
          data: {
            attended: result.attended,
            alreadyAttended: result.alreadyAttended,
          },
        },
        { status: 200 },
      );
    });
  } catch (error: unknown) {
    if (isApiUnauthorizedError(error)) {
      return apiRouteErrorResponse(error, "Unauthorized");
    }
    const message = error instanceof Error ? error.message : "Failed to mark attendance.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
