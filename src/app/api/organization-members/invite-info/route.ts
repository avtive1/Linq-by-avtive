import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { queryNeonOne } from "@/lib/neon-db";
import { ensureOrganizationMemberInviteColumns } from "@/lib/organization/member-invite-db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || "";
    if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

    await ensureOrganizationMemberInviteColumns();

    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const row = await queryNeonOne<{ member_email: string | null }>(
      `SELECT member_email
       FROM public.organization_members
       WHERE invite_token_hash = $1
         AND invite_token_expires_at IS NOT NULL
         AND invite_token_expires_at > now()
         AND status = 'active'
       LIMIT 1`,
      [hash],
    );

    if (!row || !row.member_email) {
      return NextResponse.json({ error: "Invalid or expired invitation." }, { status: 400 });
    }

    return NextResponse.json({ email: row.member_email }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
