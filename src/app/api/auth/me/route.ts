import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";

export async function GET() {
  try {
    const session = await getServerAuthSession();
    const userId = String(session?.user?.id || "").trim();
    if (!userId) return NextResponse.json({ data: null }, { status: 200 });
    return NextResponse.json({ data: { userId } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve auth user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
