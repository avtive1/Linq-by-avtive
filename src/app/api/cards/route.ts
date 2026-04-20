import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const securePayload = encryptAttendeeSensitiveFields(payload);
    const { data, error } = await supabaseAdmin
      .from("attendees")
      .insert(securePayload)
      .select()
      .single();
    if (error) {
      logSecurityEvent({
        event: "security.attendees.create_failed",
        level: "error",
        details: { reason: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
