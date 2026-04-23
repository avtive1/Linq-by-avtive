import { NextResponse } from "next/server";
import { queryNeonOne } from "@/lib/neon-db";

const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const username = String(url.searchParams.get("username") || "").trim().toLowerCase();

    if (!username || username.length < 3) {
      return NextResponse.json({ data: { available: false, reason: "too_short" } }, { status: 200 });
    }
    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ data: { available: false, reason: "invalid" } }, { status: 200 });
    }

    const existing = await queryNeonOne<{ id: string }>(
      `SELECT id
       FROM public.profiles
       WHERE username = $1
       LIMIT 1`,
      [username],
    );

    return NextResponse.json({ data: { available: !existing } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check username availability.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
