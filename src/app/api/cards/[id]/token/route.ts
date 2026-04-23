import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { issueAttendeeCardToken } from "@/lib/security/tokens";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { isValidUuid } from "@/lib/validation/uuid";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const attendee = await queryNeonOne<{ id: string; event_id: string | null; user_id: string | null }>(
      `SELECT id, event_id, user_id FROM public.attendees WHERE id = $1`,
      [id],
    );
    if (!attendee) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    let canIssue = false;
    if (attendee.event_id) {
      const event = await queryNeonOne<{ user_id: string | null }>(
        `SELECT user_id FROM public.events WHERE id = $1`,
        [attendee.event_id],
      );
      if (event?.user_id === userId) canIssue = true;
    } else if (attendee.user_id === userId) {
      canIssue = true;
    }

    if (!canIssue) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const token = await issueAttendeeCardToken({
      sub: userId,
      cardId: id,
      scope: "card:read",
    });

    logSecurityEvent({
      event: "security.card_token.issued",
      actorId: userId,
      resourceId: id,
      details: { scope: "card:read" },
    });

    return NextResponse.json({ token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    logSecurityEvent({ event: "security.card_token.issue_failed", level: "error", details: { reason: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
