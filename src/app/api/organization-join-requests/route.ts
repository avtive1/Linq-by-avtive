import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";

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

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { organizationName } = (await req.json()) as { organizationName?: string };
    const requestedOrgName = normalizeOrganizationName(String(organizationName || ""));
    const requestedOrgKey = toOrganizationKey(requestedOrgName);
    if (!requestedOrgName) {
      return NextResponse.json({ error: "organizationName is required." }, { status: 400 });
    }
    if (!requestedOrgKey) {
      return NextResponse.json({ error: "organizationName is invalid." }, { status: 400 });
    }

    const { data: alreadyMember } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("member_user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (alreadyMember?.id) {
      return NextResponse.json({ data: { status: "already_member" } }, { status: 200 });
    }

    const [{ data: selfOwnedEvents }, { data: selfOwnedMembers }] = await Promise.all([
      supabaseAdmin.from("events").select("id").eq("user_id", userId).limit(1),
      supabaseAdmin.from("organization_members").select("id").eq("org_owner_user_id", userId).limit(1),
    ]);
    if ((selfOwnedEvents || []).length > 0 || (selfOwnedMembers || []).length > 0) {
      return NextResponse.json({ data: { status: "owner_context" } }, { status: 200 });
    }

    let selectedOwnerId = "";
    const { data: existingOrg, error: orgLookupErr } = await supabaseAdmin
      .from("organizations")
      .select("owner_user_id, organization_name")
      .eq("organization_name_key", requestedOrgKey)
      .maybeSingle();
    if (orgLookupErr) return NextResponse.json({ error: orgLookupErr.message }, { status: 400 });

    if (existingOrg?.owner_user_id) {
      selectedOwnerId = existingOrg.owner_user_id;
    } else {
      const { data: allProfiles, error: candidatesErr } = await supabaseAdmin
        .from("profiles")
        .select("id, organization_name, organization_name_key, role, created_at")
        .neq("id", userId)
        .limit(2000);
      if (candidatesErr) return NextResponse.json({ error: candidatesErr.message }, { status: 400 });

      const candidates = (allProfiles || []).filter((row) => {
        const fromName = toOrganizationKey(String(row.organization_name || ""));
        const fromKey = toOrganizationKey(String(row.organization_name_key || ""));
        return fromName === requestedOrgKey || fromKey === requestedOrgKey;
      });
      if (candidates.length === 0) {
        return NextResponse.json({ data: { status: "no_owner_found" } }, { status: 200 });
      }

      const sorted = [...candidates].sort((a, b) => {
        const aAdmin = String(a.role || "").toLowerCase() === "admin" ? 0 : 1;
        const bAdmin = String(b.role || "").toLowerCase() === "admin" ? 0 : 1;
        if (aAdmin !== bAdmin) return aAdmin - bAdmin;
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
      selectedOwnerId = sorted[0].id;

      const { error: orgInsertErr } = await supabaseAdmin.from("organizations").upsert({
        organization_name: normalizeOrganizationName(String(sorted[0].organization_name || requestedOrgName)),
        organization_name_key: requestedOrgKey,
        owner_user_id: selectedOwnerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_name_key" });
      if (orgInsertErr) {
        return NextResponse.json({ error: orgInsertErr.message }, { status: 400 });
      }
    }

    if (!selectedOwnerId) {
      return NextResponse.json({ data: { status: "no_owner_found" } }, { status: 200 });
    }
    if (selectedOwnerId === userId) {
      return NextResponse.json({ data: { status: "owner_context" } }, { status: 200 });
    }

    const { data: existingPending } = await supabaseAdmin
      .from("organization_join_requests")
      .select("id, owner_user_id")
      .eq("requester_user_id", userId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (existingPending?.id) {
      return NextResponse.json(
        {
          data: {
            status: "pending_exists",
            requestId: existingPending.id,
            ownerUserId: existingPending.owner_user_id,
          },
        },
        { status: 200 },
      );
    }

    const { data: cooldownRequest } = await supabaseAdmin
      .from("organization_join_requests")
      .select("id, reapply_after")
      .eq("requester_user_id", userId)
      .eq("owner_user_id", selectedOwnerId)
      .eq("status", "rejected")
      .not("reapply_after", "is", null)
      .gt("reapply_after", new Date().toISOString())
      .order("reapply_after", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cooldownRequest?.id) {
      return NextResponse.json(
        {
          data: {
            status: "reapply_later",
            requestId: cooldownRequest.id,
            reapplyAfter: cooldownRequest.reapply_after,
          },
        },
        { status: 200 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("organization_join_requests")
      .insert({
        requester_user_id: userId,
        owner_user_id: selectedOwnerId,
        requested_org_name: requestedOrgName,
        status: "pending",
        reapply_after: null,
        rejection_reason: null,
      })
      .select("id, status")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const [{ data: ownerUserData }, { data: requesterUserData }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(selectedOwnerId),
      supabaseAdmin.auth.admin.getUserById(userId),
    ]);

    const ownerEmail = ownerUserData?.user?.email;
    if (ownerEmail) {
      await sendTransactionalEmail({
        to: ownerEmail,
        subject: `Organization verification request (${requestedOrgName})`,
        text:
          `A user requested to join your organization: ${requestedOrgName}.\n\n` +
          `Requester email: ${requesterUserData?.user?.email || "unknown"}\n` +
          `Join request ID: ${data.id}\n\n` +
          `Please review this request in your dashboard inbox.`,
      });
    }

    return NextResponse.json({ data: { status: "created", requestId: data.id } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create join request." }, { status: 500 });
  }
}
