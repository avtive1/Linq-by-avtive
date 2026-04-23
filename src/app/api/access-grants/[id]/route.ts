import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeonOne, updateRows } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { validateCsrfOrigin } from "@/lib/security/csrf";
import { isValidUuid } from "@/lib/validation/uuid";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid grant id." }, { status: 400 });
    }
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const grantRow = await queryNeonOne<{ id: string; event_id: string }>(
      `SELECT id, event_id FROM public.access_grants WHERE id = $1`,
      [id],
    );
    const grantErr = grantRow ? null : { message: "Grant not found" };
    if (grantErr || !grantRow) return NextResponse.json({ error: "Grant not found." }, { status: 404 });

    const eventRow = await queryNeonOne<{ user_id: string | null }>(
      `SELECT user_id FROM public.events WHERE id = $1`,
      [grantRow.event_id],
    );
    const eventErr = eventRow ? null : { message: "Event not found" };
    if (eventErr || !eventRow) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (eventRow.user_id !== userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const updated = await updateRows(
      "access_grants",
      { status: "revoked", updated_at: new Date().toISOString() },
      { id },
      "id",
    );
    const error = updated.length ? null : { message: "Grant update failed" };
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to revoke grant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
