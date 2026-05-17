import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerAuthSession } from "@/auth";

export async function GET(req: Request) {
  try {
    const token = await getToken({
      req: req as unknown as Parameters<typeof getToken>[0]["req"],
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === "production",
    });
    let userId = String(token?.uid || token?.sub || "").trim();
    if (!userId) {
      const session = await getServerAuthSession();
      userId = String(session?.user?.id || "").trim();
    }
    if (!userId) return NextResponse.json({ data: null }, { status: 200 });
    return NextResponse.json({ data: { userId } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve auth user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
