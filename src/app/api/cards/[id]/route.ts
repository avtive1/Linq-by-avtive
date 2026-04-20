import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isPlainObject } from "@/lib/api-guards";
import {
  decryptAttendeeSensitiveFields,
  encryptAttendeeSensitiveFields,
} from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function getAuthedSessionAndPermission(id: string) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: attendee, error: fetchError } = await supabaseAdmin
    .from("attendees")
    .select("event_id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !attendee) {
    return { error: NextResponse.json({ error: "Attendee not found" }, { status: 404 }) };
  }

  let canEdit = false;
  if (attendee.event_id) {
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("user_id")
      .eq("id", attendee.event_id)
      .single();
    if (event?.user_id === session.user.id) canEdit = true;
  } else if (attendee.user_id === session.user.id) {
    canEdit = true;
  }
  if (!canEdit) {
    return { error: NextResponse.json({ error: "Forbidden: You do not have permission to edit this card" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await getAuthedSessionAndPermission(id);
    if (auth.error) return auth.error;

    const { data: attendee, error } = await supabaseAdmin
      .from("attendees")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !attendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }

    const { row: secureRecord, migrationPatch } = decryptAttendeeSensitiveFields(attendee);
    if (Object.keys(migrationPatch).length > 0) {
      await supabaseAdmin.from("attendees").update(migrationPatch).eq("id", id);
    }

    return NextResponse.json({ data: secureRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updatePayload = await req.json();
    if (!isPlainObject(updatePayload)) {
      return NextResponse.json({ error: "Expected a JSON object body" }, { status: 400 });
    }
    const auth = await getAuthedSessionAndPermission(id);
    if (auth.error) return auth.error;
    const session = auth.session!;

    const securedPayload = encryptAttendeeSensitiveFields(updatePayload);
    const { data, error: updateError } = await supabaseAdmin
      .from("attendees")
      .update(securedPayload)
      .eq("id", id)
      .select();

    if (updateError) {
      console.error(updateError);
      logSecurityEvent({
        event: "security.attendees.api_patch_failed",
        level: "error",
        actorId: session.user.id,
        resourceId: id,
        details: { reason: updateError.message },
      });
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("API Error in PATCH /api/cards/[id]:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
