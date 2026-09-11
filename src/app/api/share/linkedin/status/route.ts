import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isLinkedInConfigured,
  unsealLinkedInSession,
  LINKEDIN_AUTH_COOKIE_NAME,
} from "@/lib/services/linkedin.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isLinkedInConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: "LinkedIn OAuth is not configured on the server.",
    });
  }

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(LINKEDIN_AUTH_COOKIE_NAME)?.value;
  if (!rawCookie) {
    return NextResponse.json({
      configured: true,
      connected: false,
    });
  }

  const session = await unsealLinkedInSession(rawCookie);
  if (!session) {
    return NextResponse.json({
      configured: true,
      connected: false,
    });
  }

  return NextResponse.json({
    configured: true,
    connected: true,
    memberName: session.memberName,
    memberPicture: session.memberPicture,
  });
}
