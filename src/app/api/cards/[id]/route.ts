import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  decryptAttendeeSensitiveFields,
  encryptAttendeeSensitiveFields,
} from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { queryNeon, queryNeonAsSystem, queryNeonOne, queryNeonOneAsSystem, runWithRlsBypassAsync } from "@/lib/neon-db";
import { deleteAttendeeForTenant, updateAttendeeForTenant } from "@/lib/db/tenant-mutations";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { isValidUuid } from "@/lib/validation/uuid";
import { verifyAttendeeCardToken } from "@/lib/security/tokens";
import { validateAttendeeCoreFields } from "@/lib/validation/attendee-fields";
import { isApprovedGuestCard } from "@/lib/services/registration.service";
import { resolveOrgTenantIdForUser } from "@/lib/tenant/resolve";
import { apiRouteErrorResponse, withApiTenantContext } from "@/lib/tenant/api-context";

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
  // Allow attendees to customize their card color and aesthetics
  return { ...payload };
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
        return { userId: String(verified.payload.sub || "").trim() || "token-user", tokenAccess: true as const, tenantId: undefined };
      }
    } catch {
      // Fall through to normal session checks.
    }
  }

  const cookieStore = await cookies();
  const userId = await getServerUserIdFromCookies(cookieStore);
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const attendee = await queryNeonOneAsSystem<{ event_id: string | null; user_id: string | null }>(
    `SELECT event_id, user_id FROM public.attendees WHERE id = $1`,
    [id],
  );
  const fetchError = attendee ? null : { message: "Not found" };

  if (fetchError || !attendee) {
    return { error: NextResponse.json({ error: "Attendee not found" }, { status: 404 }) };
  }

  let canEdit = false;
  if (attendee.event_id) {
    const event = await queryNeonOneAsSystem<{ user_id: string | null }>(
      `SELECT user_id FROM public.events WHERE id = $1`,
      [attendee.event_id],
    );
    if (event?.user_id === userId) {
      canEdit = true;
    } else {
      const membership = await queryNeonOneAsSystem<{ id: string }>(
        `SELECT id
         FROM public.organization_members
         WHERE member_user_id = $1
           AND org_owner_user_id = $2
           AND status = 'active'
         LIMIT 1`,
        [userId, String(event?.user_id || "")],
      );
      if (membership?.id) {
        const grants = await queryNeonAsSystem<{ permission: string }>(
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
  return { userId, tokenAccess: false as const, tenantId: await resolveOrgTenantIdForUser(userId) };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    const auth = await getAuthedSessionAndPermission(_, id, "read");
    if (auth.error) return auth.error;

    const loadCard = async () => {
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
        if (auth.tenantId) {
          await updateAttendeeForTenant(id, auth.tenantId, migrationPatch, "id");
        } else {
          await runWithRlsBypassAsync(async () => {
            const { updateRows } = await import("@/lib/neon-db");
            await updateRows("attendees", migrationPatch, { id }, "id");
          });
        }
      }

      const identityLocked = await isApprovedGuestCard(id);
      return NextResponse.json({ data: secureRecord, identityLocked });
    };

    if (auth.tokenAccess) {
      return runWithRlsBypassAsync(loadCard);
    }

    const cookieStore = await cookies();
    return withApiTenantContext(cookieStore, loadCard);
  } catch (err: unknown) {
    return apiRouteErrorResponse(err, "Internal Server Error");
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

    const applyPatch = async () => {
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
      const data = auth.tenantId
        ? await updateAttendeeForTenant(id, auth.tenantId, securedPayload)
        : await (async () => {
            const { updateRows } = await import("@/lib/neon-db");
            return updateRows("attendees", securedPayload, { id });
          })();
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
    };

    if (auth.tokenAccess) {
      return runWithRlsBypassAsync(applyPatch);
    }
    const cookieStore = await cookies();
    return withApiTenantContext(cookieStore, applyPatch);
  } catch (err: unknown) {
    return apiRouteErrorResponse(err, "Internal Server Error");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    const auth = await getAuthedSessionAndPermission(_, id, "delete");
    if (auth.error) return auth.error;

    const performDelete = async () => {
      const deleted = auth.tenantId
        ? await deleteAttendeeForTenant(id, auth.tenantId)
        : await runWithRlsBypassAsync(async () => {
            const rows = await queryNeon<{ id: string }>(
              `DELETE FROM public.attendees WHERE id = $1 RETURNING id`,
              [id],
            );
            return rows.length > 0;
          });

      if (!deleted) {
        return NextResponse.json({ error: "Attendee not found." }, { status: 404 });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    };

    if (auth.tokenAccess) {
      return runWithRlsBypassAsync(performDelete);
    }
    const cookieStore = await cookies();
    return withApiTenantContext(cookieStore, performDelete);
  } catch (err: unknown) {
    return apiRouteErrorResponse(err, "Internal Server Error");
  }
}
