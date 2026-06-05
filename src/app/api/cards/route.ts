import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { createAttendeeCardFromPayload } from "@/lib/services/event.service";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { attendeeRegistrationBodySchema } from "@/lib/validators/registration.validator";

export async function POST(req: Request) {
  try {
    try {
      await queryNeon(
        `ALTER TABLE public.attendees
         ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb`,
      );
    } catch (schemaErr) {
      console.warn("Skipping attendees.custom_fields runtime schema patch:", schemaErr);
    }

    const parsed = await parseJsonBody(req, attendeeRegistrationBodySchema);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data as Record<string, unknown>;
    const cookieStore = await cookies();
    const authUserId = await getServerUserIdFromCookies(cookieStore);
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const { data, shareToken } = await createAttendeeCardFromPayload({
      payload,
      authUserId,
      bearerToken,
    });

    return NextResponse.json({ data, shareToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
