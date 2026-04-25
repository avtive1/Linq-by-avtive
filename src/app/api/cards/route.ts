import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { insertRow } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { issueAttendeeCardToken } from "@/lib/security/tokens";
import { verifyAttendeeCardToken } from "@/lib/security/tokens";

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Record<string, unknown>;
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
      const eventId = String(payload.event_id || "").trim();
      if (!eventId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      isPublicEventRegistration = true;
    }
    const securePayload = encryptAttendeeSensitiveFields(payload) as Record<string, unknown>;
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
          scope: "card:read",
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
