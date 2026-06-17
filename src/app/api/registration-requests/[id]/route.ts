import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  approveRegistrationRequest,
  countPendingRegistrationsForEvent,
  getPublicRegistrationStatus,
  rejectRegistrationRequest,
} from "@/lib/services/registration.service";
import {
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
} from "@/lib/services/email.service";
import {
  emitRegistrationApprovedToUser,
  emitRegistrationPendingCountUpdatedToOrg,
  emitRegistrationRejectedToUser,
  emitRegistrationUpdatedToOrg,
} from "@/lib/services/realtime.service";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";
import { updateTenantRows } from "@/lib/db/tenant-mutations";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { registrationReviewBodySchema } from "@/lib/validators/registration.validator";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }

    const status = await getPublicRegistrationStatus(id);
    if (!status) {
      return NextResponse.json({ error: "Registration request not found." }, { status: 404 });
    }

    return NextResponse.json({ data: status }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load registration status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) {
      return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }

    const parsed = await parseJsonBody(req, registrationReviewBodySchema);
    if (!parsed.ok) return parsed.response;
    const { decision, rejectionReason } = parsed.data;

    const cookieStore = await cookies();
    const reviewerUserId = await getServerUserIdFromCookies(cookieStore);
    if (!reviewerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (decision === "approve") {
      let result;
      try {
        result = await approveRegistrationRequest({
          requestId: id,
          reviewerUserId,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to approve registration.";
        const status =
          message === "Forbidden."
            ? 403
            : message.includes("already reviewed")
              ? 409
              : 400;
        return NextResponse.json({ error: message }, { status });
      }

      const { request, cardId, shareToken, attendeeEmail, eventName, eventShortId } = result;
      const pendingCount = await countPendingRegistrationsForEvent(request.event_id);

      let notifyError: string | null = null;
      if (attendeeEmail) {
        const emailResult = await sendRegistrationApprovedEmail({
          to: attendeeEmail,
          eventName,
          cardId,
          shareToken,
          eventId: request.event_id,
          eventShortId,
        });
        if (emailResult.sent) {
          await updateTenantRows(
            "registration_requests",
            { attendee_notified_at: new Date().toISOString(), notification_error: null },
            { id },
            request.organization_id,
            "id",
          );
        } else {
          notifyError = emailResult.error || "Attendee notification failed.";
        }
      } else {
        notifyError = "Attendee email missing; notification skipped.";
      }
      if (notifyError) {
        await updateTenantRows(
          "registration_requests",
          { notification_error: notifyError },
          { id },
          request.organization_id,
          "id",
        );
      }

      const realtimePayload = {
        requestId: id,
        eventId: request.event_id,
        organizationId: request.organization_id,
        status: "APPROVED" as const,
        cardId,
        shareToken,
      };

      await emitRegistrationUpdatedToOrg({
        organizationId: request.organization_id,
        eventId: request.event_id,
        payload: realtimePayload,
      });
      await emitRegistrationPendingCountUpdatedToOrg({
        organizationId: request.organization_id,
        eventId: request.event_id,
        pendingCount,
      });
      await emitRegistrationApprovedToUser({
        requestId: id,
        payload: realtimePayload,
      });

      return NextResponse.json(
        {
          data: {
            status: "APPROVED",
            cardId,
            shareToken,
          },
        },
        { status: 200 },
      );
    }

    const trimmedReason = String(rejectionReason || "").trim();

    let rejectResult;
    try {
      rejectResult = await rejectRegistrationRequest({
        requestId: id,
        reviewerUserId,
        reason: trimmedReason,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reject registration.";
      const status =
        message === "Forbidden."
          ? 403
          : message.includes("already reviewed")
            ? 409
            : 400;
      return NextResponse.json({ error: message }, { status });
    }

    const { request, attendeeEmail, eventName, eventShortId } = rejectResult;
    const pendingCount = await countPendingRegistrationsForEvent(request.event_id);

    let notifyError: string | null = null;
    if (attendeeEmail) {
      const emailResult = await sendRegistrationRejectedEmail({
        to: attendeeEmail,
        eventName,
        rejectionReason: trimmedReason,
        eventId: request.event_id,
        eventShortId,
      });
      if (emailResult.sent) {
        await updateTenantRows(
          "registration_requests",
          { attendee_notified_at: new Date().toISOString(), notification_error: null },
          { id },
          request.organization_id,
          "id",
        );
      } else {
        notifyError = emailResult.error || "Attendee notification failed.";
      }
    } else {
      notifyError = "Attendee email missing; notification skipped.";
    }
    if (notifyError) {
      await updateTenantRows(
        "registration_requests",
        { notification_error: notifyError },
        { id },
        request.organization_id,
        "id",
      );
    }

    const realtimePayload = {
      requestId: id,
      eventId: request.event_id,
      organizationId: request.organization_id,
      status: "REJECTED" as const,
      rejectionReason: trimmedReason,
    };

    await emitRegistrationUpdatedToOrg({
      organizationId: request.organization_id,
      eventId: request.event_id,
      payload: realtimePayload,
    });
    await emitRegistrationPendingCountUpdatedToOrg({
      organizationId: request.organization_id,
      eventId: request.event_id,
      pendingCount,
    });
    await emitRegistrationRejectedToUser({
      requestId: id,
      payload: realtimePayload,
    });

    return NextResponse.json({ data: { status: "REJECTED" } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to review registration request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
