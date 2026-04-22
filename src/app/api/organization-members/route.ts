import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { seedViewEventGrantsForOrgMember } from "@/lib/organization/seedViewEventGrants";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getCurrentUserId() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
  const { data: authData } = await supabase.auth.getUser();
  return authData.user?.id || null;
}

export async function GET() {
  try {
    const ownerId = await getCurrentUserId();
    if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .select("id, member_user_id, member_email, role_label, status, created_at")
      .eq("org_owner_user_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = await Promise.all(
      (data || []).map(async (row) => {
        let permissions: string[] = [];
        let email = row.member_email || "unknown";

        if (row.member_user_id) {
          const [{ data: userData }, { data: grants }] = await Promise.all([
            supabaseAdmin.auth.admin.getUserById(row.member_user_id),
            supabaseAdmin
              .from("access_grants")
              .select("permission")
              .eq("grantee_user_id", row.member_user_id)
              .eq("status", "active"),
          ]);
          permissions = Array.from(new Set((grants || []).map((g: { permission: string }) => g.permission)));
          if (userData?.user?.email) email = userData.user.email;
        }

        return {
          ...row,
          member_email: email,
          permissions,
        };
      }),
    );

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load organization members." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ownerId = await getCurrentUserId();
    if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { email, roleLabel, permissions } = (await req.json()) as {
      email?: string;
      roleLabel?: string;
      permissions?: string[];
    };
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const nextRoleLabel = String(roleLabel || "").trim();
    if (!normalizedEmail || !nextRoleLabel) {
      return NextResponse.json({ error: "email and roleLabel are required." }, { status: 400 });
    }
    const allowedPermissions = ["create_event", "manage_event", "edit_cards", "delete_cards"];
    const normalizedPermissions = (permissions || []).filter((p) => allowedPermissions.includes(p));

    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });

    const target = (usersData?.users || []).find((u) => (u.email || "").toLowerCase() === normalizedEmail);
    if (target?.id === ownerId) {
      return NextResponse.json({ error: "Owner cannot add self as member." }, { status: 400 });
    }

    // Check if this email is already an active member of ANY organization
    const { data: activeMembership } = await supabaseAdmin
      .from("organization_members")
      .select("org_owner_user_id")
      .or(`member_email.eq.${normalizedEmail}${target?.id ? `,member_user_id.eq.${target.id}` : ""}`)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (activeMembership?.org_owner_user_id && activeMembership.org_owner_user_id !== ownerId) {
      return NextResponse.json(
        { error: "This user already belongs to another active organization." },
        { status: 409 },
      );
    }

    // Upsert the membership based on org_owner_user_id and member_email
    const { error: upsertError } = await supabaseAdmin.from("organization_members").upsert(
      {
        org_owner_user_id: ownerId,
        member_email: normalizedEmail,
        member_user_id: target?.id || null,
        role_label: nextRoleLabel,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_owner_user_id,member_email" }
    );
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });

    // If user exists, seed default view grants
    if (target?.id) {
      try {
        await seedViewEventGrantsForOrgMember(supabaseAdmin, ownerId, target.id);
      } catch (e: any) {
        // Log but don't fail the whole request
        console.error("Grant seeding failed:", e);
      }
    }

    await supabaseAdmin
      .from("organization_role_permission_templates")
      .upsert(
        {
          org_owner_user_id: ownerId,
          role_label: nextRoleLabel,
          permissions: normalizedPermissions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_owner_user_id,role_label" },
      );

    if (normalizedPermissions.length > 0 && target?.id) {
      const { data: ownerEvents } = await supabaseAdmin.from("events").select("id").eq("user_id", ownerId);
      const eventIds = (ownerEvents || []).map((e) => e.id);
      if (eventIds.length > 0) {
        const { data: existing } = await supabaseAdmin
          .from("access_grants")
          .select("event_id, permission")
          .in("event_id", eventIds)
          .eq("grantee_user_id", target.id)
          .eq("status", "active");
        const existingSet = new Set((existing || []).map((g: { event_id: string; permission: string }) => `${g.event_id}:${g.permission}`));
        const toInsert: Array<Record<string, unknown>> = [];
        for (const eventId of eventIds) {
          for (const permission of normalizedPermissions) {
            const key = `${eventId}:${permission}`;
            if (existingSet.has(key)) continue;
            toInsert.push({
              event_id: eventId,
              grantee_user_id: target.id,
              granted_by_user_id: ownerId,
              permission,
              status: "active",
            });
          }
        }
        if (toInsert.length > 0) {
          await supabaseAdmin.from("access_grants").insert(toInsert);
        }
      }
    }

    if (target?.email) {
      await sendTransactionalEmail({
        to: target.email,
        subject: "You were granted organization access",
        text:
          `You were added to an organization with role "${nextRoleLabel}".\n\n` +
          `Default permissions: ${normalizedPermissions.length ? normalizedPermissions.join(", ") : "none"}\n\n` +
          `Sign in to your dashboard to continue.`,
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to add organization member." }, { status: 500 });
  }
}
