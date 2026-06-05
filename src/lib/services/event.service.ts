import { encryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { issueAttendeeCardToken, verifyAttendeeCardToken } from "@/lib/security/tokens";
import { insertRow } from "@/lib/neon-db";
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

export type CreateAttendeeCardInput = {
  payload: Record<string, unknown>;
  authUserId: string | null;
  bearerToken?: string | null;
  forcePublicRegistration?: boolean;
};

export type CreateAttendeeCardResult = {
  data: Record<string, unknown>;
  shareToken: string | null;
};

export async function createAttendeeCardFromPayload(
  input: CreateAttendeeCardInput,
): Promise<CreateAttendeeCardResult> {
  const validation = validateAttendeeCoreFields(input.payload);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  const sanitizedPayload = validation.payload;
  if (
    "custom_fields" in sanitizedPayload &&
    (sanitizedPayload.custom_fields === null ||
      typeof sanitizedPayload.custom_fields !== "object" ||
      Array.isArray(sanitizedPayload.custom_fields))
  ) {
    throw new Error("custom_fields must be an object.");
  }

  let tokenUserId: string | null = null;
  const bearerToken = String(input.bearerToken || "").trim();
  if (bearerToken) {
    try {
      const verified = await verifyAttendeeCardToken(bearerToken);
      tokenUserId = String(verified.payload.sub || "").trim() || null;
    } catch {
      tokenUserId = null;
    }
  }

  const authUserId = input.authUserId;
  let isPublicEventRegistration = Boolean(input.forcePublicRegistration);
  if (!authUserId && !tokenUserId && !isPublicEventRegistration) {
    const eventId = String(sanitizedPayload.event_id || "").trim();
    if (!eventId) {
      throw new Error("Unauthorized");
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
      error = {
        message: fallbackError instanceof Error ? fallbackError.message : "Insert failed",
      };
    }
  }

  if (error || !data) {
    logSecurityEvent({
      event: "security.attendees.create_failed",
      level: "error",
      details: { reason: error?.message || "Insert failed" },
    });
    throw new Error(error?.message || "Insert failed");
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

  return { data, shareToken };
}
