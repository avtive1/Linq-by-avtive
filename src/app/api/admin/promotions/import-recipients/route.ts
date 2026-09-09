import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { logger } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

interface RecipientInput {
  name?: string;
  email?: string;
  linkedin?: string;
  company?: string;
  role?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { eventId, recipients } = body as {
      eventId?: string;
      recipients?: RecipientInput[];
    };

    if (!eventId) {
      return NextResponse.json(
        { error: "Campaign ID (eventId) is required for importing recipients." },
        { status: 400 },
      );
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipient records provided." },
        { status: 400 },
      );
    }

    // Verify campaign ownership or admin permission
    const event = await queryNeonOne<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM public.events WHERE id = $1`,
      [eventId],
    );

    if (!event) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const sessionEmail = session?.user?.email?.trim().toLowerCase();
    const isAdmin = Boolean(sessionEmail && adminEmails.includes(sessionEmail));
    const isOwner = event.user_id === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Not campaign owner" }, { status: 403 });
    }

    // Non-destructive insert: Only insert new attendee records, never replace or delete existing attendees
    let insertedCount = 0;
    for (const r of recipients.slice(0, 500)) {
      const email = r.email?.trim().toLowerCase() || null;
      const name = r.name?.trim() || "Attendee";
      const linkedin = r.linkedin?.trim() || null;
      const company = r.company?.trim() || null;
      const role = r.role?.trim() || null;

      // Check if attendee with this email already exists for this campaign
      if (email) {
        const existing = await queryNeonOne<{ id: string }>(
          `SELECT id FROM public.attendees WHERE event_id = $1 AND card_email = $2 LIMIT 1`,
          [eventId, email],
        );
        if (existing) {
          // Skip existing attendee to avoid overwriting or duplicates
          continue;
        }
      }

      await queryNeon(
        `INSERT INTO public.attendees (event_id, user_id, name, card_email, linkedin, company, role, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          eventId,
          event.user_id,
          name,
          email,
          linkedin,
          company,
          role,
          JSON.stringify({ importedFromPromotion: true }),
        ],
      );
      insertedCount++;
    }

    logger.info(
      { eventId, insertedCount, totalReceived: recipients.length },
      "Non-destructive recipient import completed",
    );

    return NextResponse.json({
      success: true,
      importedCount: insertedCount,
      totalCount: recipients.length,
      message: `Successfully imported ${insertedCount} new recipients. Existing attendees were preserved.`,
    });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to import recipients");
    const msg = err instanceof Error ? err.message : "Failed to import recipients";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
