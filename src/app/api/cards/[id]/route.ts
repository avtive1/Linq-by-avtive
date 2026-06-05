import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  decryptAttendeeSensitiveFields,
  encryptAttendeeSensitiveFields,
} from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { queryNeon, queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { isValidUuid } from "@/lib/validation/uuid";
import { verifyAttendeeCardToken } from "@/lib/security/tokens";
import { validateAttendeeCoreFields } from "@/lib/validation/attendee-fields";
import { isApprovedGuestCard } from "@/lib/services/registration.service";

const APPROVED_GUEST_LOCKED_FIELDS = ["name", "company", "card_email"] as const;

function preserveApprovedGuestIdentityFields(
  updatePayload: Record<string, unknown>,
  existing: Record<string, unknown>,
) {
  const next = { ...updatePayload };
  for (const field of APPROVED_GUEST_LOCKED_FIELDS) {
    if (field in next) {
      next[field] = existing[field];
    }
  }
  return next;
}

function stripBrandingMutations(payload: Record<string, unknown>) {
  const sanitized = { ...payload };
  delete sanitized.card_color;
  delete sanitized.design_type;
  delete sanitized.card_font;
  delete sanitized.custom_fields;
  return sanitized;
}

async function getAuthedSessionAndPermission(
  req: Request,
  id: string,
  mode: "read" | "edit" | "delete" = "read",
) {
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (bearerToken && mode !== "delete") {
    try {
      const verified = await verifyAttendeeCardToken(bearerToken);
      const tokenCardId = String(verified.payload.cardId || "").trim();
      const tokenScope = String(verified.payload.scope || "").trim();
      const hasReadScope = tokenScope.includes("card:read");
      const hasEditScope = tokenScope.includes("card:edit");
      const tokenCanRead = hasReadScope || hasEditScope;
      const tokenCanEdit = hasEditScope;
      const tokenAllowed = mode === "read" ? tokenCanRead : tokenCanEdit;
      if (tokenCardId === id && tokenAllowed) {
        return { userId: String(verified.payload.sub || "").trim() || "token-user", tokenAccess: true as const };
      }
    } catch {
      // Fall through to normal session checks.
    }
  }

  const cookieStore = await cookies();
  const userId = await getServerUserIdFromCookies(cookieStore);
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const attendee = await queryNeonOne<{ event_id: string | null; user_id: string | null }>(
    `SELECT event_id, user_id FROM public.attendees WHERE id = $1`,
    [id],
  );
  const fetchError = attendee ? null : { message: "Not found" };

  if (fetchError || !attendee) {
    return { error: NextResponse.json({ error: "Attendee not found" }, { status: 404 }) };
  }

  let canEdit = false;
  if (attendee.event_id) {
    const event = await queryNeonOne<{ user_id: string | null }>(
      `SELECT user_id FROM public.events WHERE id = $1`,
      [attendee.event_id],
    );
    if (event?.user_id === userId) {
      canEdit = true;
    } else {
      const membership = await queryNeonOne<{ id: string }>(
        `SELECT id
         FROM public.organization_members
         WHERE member_user_id = $1
           AND org_owner_user_id = $2
           AND status = 'active'
         LIMIT 1`,
        [userId, String(event?.user_id || "")],
      );
      if (membership?.id) {
        const grants = await queryNeon<{ permission: string }>(
          `SELECT permission
           FROM public.access_grants
           WHERE event_id = $1
             AND grantee_user_id = $2
             AND status = 'active'`,
          [attendee.event_id, userId],
        );
        const permissions = new Set(grants.map((g) => String(g.permission || "")));
        canEdit =
          mode === "delete"
            ? permissions.has("manage_event") || permissions.has("delete_cards")
            : permissions.has("manage_event") || permissions.has("edit_cards");
      }
    }
  } else if (attendee.user_id === userId) {
    canEdit = true;
  }
  if (!canEdit) {
    return { error: NextResponse.json({ error: "Forbidden: You do not have permission to edit this card" }, { status: 403 }) };
  }
  return { userId, tokenAccess: false as const };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    const auth = await getAuthedSessionAndPermission(_, id, "read");
    if (auth.error) return auth.error;

    const attendee = await queryNeonOne<Record<string, unknown>>(
      `SELECT * FROM public.attendees WHERE id = $1`,
      [id],
    );
    const error = attendee ? null : { message: "Not found" };
    if (error || !attendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }

    const { row: secureRecord, migrationPatch } = decryptAttendeeSensitiveFields(attendee);
    if (Object.keys(migrationPatch).length > 0) {
      await updateRows("attendees", migrationPatch, { id }, "id");
    }

    const identityLocked = await isApprovedGuestCard(id);
    return NextResponse.json({ data: secureRecord, identityLocked });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    const updatePayload = (await req.json()) as Record<string, unknown>;
    const validation = validateAttendeeCoreFields(updatePayload);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const auth = await getAuthedSessionAndPermission(req, id, "edit");
    if (auth.error) return auth.error;
    const userId = auth.userId!;

    const existingAttendee = await queryNeonOne<Record<string, unknown>>(
      `SELECT * FROM public.attendees WHERE id = $1`,
      [id],
    );
    if (!existingAttendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }
    const { row: existingSecure } = decryptAttendeeSensitiveFields(existingAttendee);

    let permittedPayload = auth.tokenAccess
      ? stripBrandingMutations(validation.payload as Record<string, unknown>)
      : (validation.payload as Record<string, unknown>);

    if (await isApprovedGuestCard(id)) {
      permittedPayload = preserveApprovedGuestIdentityFields(permittedPayload, existingSecure);
    }

    const securedPayload = encryptAttendeeSensitiveFields(permittedPayload);
    const data = await updateRows("attendees", securedPayload, { id });
    const updateError = data.length ? null : { message: "No row updated" };

    if (updateError) {
      logSecurityEvent({
        event: "security.attendees.api_patch_failed",
        level: "error",
        actorId: userId,
        resourceId: id,
        details: { reason: updateError.message },
      });
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    const auth = await getAuthedSessionAndPermission(_, id, "delete");
    if (auth.error) return auth.error;

    const deleted = await queryNeon<{ id: string }>(
      `DELETE FROM public.attendees WHERE id = $1 RETURNING id`,
      [id],
    );

    if (!deleted.length) {
      return NextResponse.json({ error: "Attendee not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
