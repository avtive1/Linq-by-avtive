import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { logSecurityEvent } from "@/lib/security/telemetry";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: event } = await supabaseAdmin.from("events").select("user_id").eq("id", id).single();
    if (!event || event.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("attendees")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const decrypted = (data || []).map((row) => {
      const { row: secure, migrationPatch } = decryptAttendeeSensitiveFields(row);
      if (Object.keys(migrationPatch).length > 0) {
        void (async () => {
          try {
            const { error } = await supabaseAdmin
              .from("attendees")
              .update(migrationPatch)
              .eq("id", row.id);
            if (error) {
              logSecurityEvent({
                event: "security.event_attendees.lazy_reencrypt_failed",
                level: "warn",
                details: { id: row.id, reason: error.message },
              });
            }
          } catch (reason: unknown) {
            logSecurityEvent({
              event: "security.event_attendees.lazy_reencrypt_failed",
              level: "warn",
              details: {
                id: row.id,
                reason: reason instanceof Error ? reason.message : "unknown",
              },
            });
          }
        })();
      }
      return secure;
    });

    return NextResponse.json({ data: decrypted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    logSecurityEvent({
      event: "security.event_attendees.fetch_failed",
      level: "error",
      details: { reason: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
