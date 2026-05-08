import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { insertRow, queryNeon } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { issueAttendeeCardToken } from "@/lib/security/tokens";
import { verifyAttendeeCardToken } from "@/lib/security/tokens";
import { validateAttendeeCoreFields } from "@/lib/validation/attendee-fields";

function stripAttendeeBrandingFields(payload: Record<string, unknown>) {
  const sanitized = { ...payload };
  delete sanitized.card_color;
  delete sanitized.design_type;
  delete sanitized.card_font;
  const customFieldsRaw = sanitized.custom_fields;
  if (
    customFieldsRaw &&
    typeof customFieldsRaw === "object" &&
    !Array.isArray(customFieldsRaw)
  ) {
    const nextCustomFields = { ...(customFieldsRaw as Record<string, unknown>) };
    delete nextCustomFields.__horizontal_text_color;
    delete nextCustomFields.__vertical_text_color;
    sanitized.custom_fields = nextCustomFields;
  }
  return sanitized;
}

export async function POST(req: Request) {
  try {
    try {
      await queryNeon(
        `ALTER TABLE public.attendees
         ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb`,
      );
    } catch (schemaErr) {
      // Do not block card creation if runtime schema patch cannot run (permissions/lock/env differences).
      console.warn("Skipping attendees.custom_fields runtime schema patch:", schemaErr);
    }
    const payload = (await req.json()) as Record<string, unknown>;
    const validation = validateAttendeeCoreFields(payload);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const sanitizedPayload = validation.payload;
    if (
      "custom_fields" in sanitizedPayload &&
      (sanitizedPayload.custom_fields === null ||
        typeof sanitizedPayload.custom_fields !== "object" ||
        Array.isArray(sanitizedPayload.custom_fields))
    ) {
      return NextResponse.json({ error: "custom_fields must be an object." }, { status: 400 });
    }
    const cookieStore = await cookies();
    const authUserId = await getServerUserIdFromCookies(cookieStore);
    let tokenUserId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const verified = await verifyAttendeeCardToken(token);
          tokenUserId = String(verified.payload.sub || "").trim() || null;
        } catch {
          tokenUserId = null;
        }
      }
    }

    let isPublicEventRegistration = false;
    if (!authUserId && !tokenUserId) {
      const eventId = String(sanitizedPayload.event_id || "").trim();
      if (!eventId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      isPublicEventRegistration = true;
    }
    const shouldRestrictBranding = isPublicEventRegistration || (!!tokenUserId && !authUserId);
    const writePayload = shouldRestrictBranding
      ? stripAttendeeBrandingFields(sanitizedPayload as Record<string, unknown>)
      : sanitizedPayload;
    const securePayload = encryptAttendeeSensitiveFields(writePayload) as Record<string, unknown>;
    if (isPublicEventRegistration && !securePayload.user_id) {
      securePayload.user_id = null;
    }

    let data: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;
    try {
      data = await insertRow("attendees", securePayload);
    } catch (insertError: unknown) {
      error = { message: insertError instanceof Error ? insertError.message : "Insert failed" };
    }

    // Backward-compatible fallback for environments where the lookup tag column
    // has not been migrated yet.
    if (
      error?.message?.includes("card_email_lookup_tag") &&
      error?.message?.toLowerCase().includes("schema cache")
    ) {
      const fallbackPayload = { ...securePayload };
      delete fallbackPayload.card_email_lookup_tag;
      try {
        data = await insertRow("attendees", fallbackPayload);
        error = null;
      } catch (fallbackError: unknown) {
        error = { message: fallbackError instanceof Error ? fallbackError.message : "Insert failed" };
      }
    }

    if (error || !data) {
      logSecurityEvent({
        event: "security.attendees.create_failed",
        level: "error",
        details: { reason: error?.message || "Insert failed" },
      });
      return NextResponse.json({ error: error?.message || "Insert failed" }, { status: 400 });
    }
    const createdCardId = String(data.id || "").trim();
    let shareToken: string | null = null;
    if (createdCardId) {
      try {
        const tokenSubject =
          authUserId ||
          tokenUserId ||
          (isPublicEventRegistration ? "public-registration" : "") ||
          "anonymous";
        shareToken = await issueAttendeeCardToken({
          sub: tokenSubject,
          cardId: createdCardId,
          scope: "card:edit",
        });
      } catch {
        shareToken = null;
      }
    }
    return NextResponse.json({ data, shareToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
