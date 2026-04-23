import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";

export async function GET() {
  try {
    const session = await getServerAuthSession();
    const userId = String(session?.user?.id || "").trim();
    if (!userId) return NextResponse.json({ data: { isAdmin: false } }, { status: 200 });

    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role = String(session?.user?.role || "").toLowerCase();
    const email = String(session?.user?.email || "").toLowerCase().trim();
    const isAdmin = role === "admin" || Boolean(email && adminEmails.includes(email));
    return NextResponse.json({ data: { isAdmin } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve admin state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
