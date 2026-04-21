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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role = session.user.user_metadata?.role;
    const isAdminByRole = typeof role === "string" && role.toLowerCase() === "admin";
    const isAdminByEmail = Boolean(
      session.user.email && adminEmails.includes(session.user.email.toLowerCase()),
    );
    const isAdmin = isAdminByRole || isAdminByEmail;

    const requestUrl = new URL(req.url);
    const impersonateId = requestUrl.searchParams.get("impersonate");

    const { data: event } = await supabaseAdmin.from("events").select("user_id").eq("id", id).single();
    const ownsEvent = Boolean(event && event.user_id === session.user.id);
    const canPreviewAsOrg = Boolean(
      event && isAdmin && impersonateId && event.user_id === impersonateId,
    );

    let isOrgTeamViewer = false;
    if (event?.user_id) {
      const { data: membership } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("member_user_id", session.user.id)
        .eq("org_owner_user_id", event.user_id)
        .eq("status", "active")
        .maybeSingle();
      isOrgTeamViewer = Boolean(membership?.id);
    }

    if (!event || (!ownsEvent && !canPreviewAsOrg && !isOrgTeamViewer)) {
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
        supabaseAdmin.from("attendees").update(migrationPatch).eq("id", row.id).then(() => {});
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
