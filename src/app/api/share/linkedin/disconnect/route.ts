import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LINKEDIN_AUTH_COOKIE_NAME } from "@/lib/services/linkedin.service";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(LINKEDIN_AUTH_COOKIE_NAME);
  return NextResponse.json({ success: true, message: "LinkedIn account disconnected." });
}
