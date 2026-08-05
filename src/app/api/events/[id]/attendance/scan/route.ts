import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { markAttendanceByQrScan } from "@/lib/services/attendance.service";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";
import { apiRouteErrorResponse, isApiUnauthorizedError, withApiTenantContext } from "@/lib/tenant/api-context";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) {
      return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });
    }

    const { id: eventId } = await params;
    if (!isValidUuid(eventId)) {
      return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
    }

    let body: { qrPayload?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const qrPayload = String(body?.qrPayload || "").trim();
    if (!qrPayload) {
      return NextResponse.json({ error: "QR code payload is required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const ownerUserId = await getServerUserIdFromCookies(cookieStore);
    if (!ownerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return withApiTenantContext(cookieStore, async () => {
      const result = await markAttendanceByQrScan({
        eventId,
        qrPayload,
        ownerUserId,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            error: result.message,
            data: {
              alreadyAttended: Boolean(result.alreadyAttended),
              attendee: result.attendee,
            },
          },
          { status: result.alreadyAttended ? 200 : 400 },
        );
      }

      return NextResponse.json(
        {
          data: {
            success: true,
            message: result.message,
            alreadyAttended: false,
            attendee: result.attendee,
          },
        },
        { status: 200 },
      );
    });
  } catch (error: unknown) {
    if (isApiUnauthorizedError(error)) {
      return apiRouteErrorResponse(error, "Unauthorized");
    }
    const message = error instanceof Error ? error.message : "Failed to verify attendance QR.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
