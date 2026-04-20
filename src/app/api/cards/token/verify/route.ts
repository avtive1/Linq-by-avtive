import { NextResponse } from "next/server";
import { verifyAttendeeCardToken } from "@/lib/security/tokens";
import { logSecurityEvent } from "@/lib/security/telemetry";

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token) return NextResponse.json({ error: "Token is required." }, { status: 400 });

    const verified = await verifyAttendeeCardToken(token);
    return NextResponse.json({
      valid: true,
      payload: verified.payload,
      protectedHeader: verified.protectedHeader,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Token verification failed.";
    logSecurityEvent({
      event: "security.card_token.verify_failed",
      level: "warn",
      details: { reason },
    });
    return NextResponse.json({ valid: false, error: reason }, { status: 401 });
  }
}
