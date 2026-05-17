import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPublicAppUrl } from "@/lib/app-url";
import { sendTeamMemberAddedOwnerNoticeEmail, sendTeamMemberInviteEmail } from "@/lib/notifications/org-emails";
import { createInviteRawToken, ensureOrganizationMemberInviteColumns } from "@/lib/organization/member-invite-db";
import { syncOrgMemberAccessGrantsFromTemplate } from "@/lib/organization/sync-org-member-access-grants";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserByEmail, getAdminUserEmailById } from "@/lib/admin";
import { validateCsrfOrigin } from "@/lib/security/csrf";

const EDITABLE_ORG_PERMISSIONS = ["create_event", "manage_event", "edit_cards", "delete_cards"] as const;

async function getCurrentUserId() {
  const cookieStore = await cookies();
  return getServerUserIdFromCookies(cookieStore);
}

export async function GET(req: Request) {
  try {
    const ownerId = await getCurrentUserId();
    if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    const data = await queryNeon<{
      id: string;
      member_user_id: string | null;
      member_email: string | null;
      role_label: string;
      status: string;
      created_at: string;
    }>(
      `SELECT id, member_user_id, member_email, role_label, status, created_at
       FROM public.organization_members
       WHERE org_owner_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2
       OFFSET $3`,
      [ownerId, limit, offset],
    );
    const countRow = await queryNeonOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM public.organization_members
       WHERE org_owner_user_id = $1`,
      [ownerId],
    );
    const userIds = Array.from(
      new Set(data.map((row) => row.member_user_id).filter((v): v is string => Boolean(v))),
    );
    const emailRows = userIds.length
      ? await queryNeon<{ user_id: string; email: string }>(
          `SELECT user_id, email
           FROM public.auth_users
           WHERE user_id = ANY($1::uuid[])`,
          [userIds],
        )
      : [];
    const emailByUserId = new Map(emailRows.map((r) => [r.user_id, r.email]));
    const grantRows = userIds.length
      ? await queryNeon<{ grantee_user_id: string; permission: string }>(
          `SELECT g.grantee_user_id, g.permission
           FROM public.access_grants g
           LEFT JOIN public.events e
             ON e.id = g.event_id
           WHERE g.grantee_user_id = ANY($1::uuid[])
             AND g.status = 'active'
             AND (
               e.user_id = $2
               OR g.granted_by_user_id = $2
             )`,
          [userIds, ownerId],
        )
      : [];
    const roleLabels = Array.from(
      new Set(data.map((row) => String(row.role_label || "").trim()).filter((label) => Boolean(label))),
    );
    const templateRows = roleLabels.length
      ? await queryNeon<{ role_label: string; permissions: string[] | null }>(
          `SELECT role_label, permissions
           FROM public.organization_role_permission_templates
           WHERE org_owner_user_id = $1
             AND role_label = ANY($2::text[])`,
          [ownerId, roleLabels],
        )
      : [];
    const permissionsByRoleLabel = new Map<string, string[]>();
    for (const row of templateRows) {
      const templatePermissions = Array.isArray(row.permissions) ? row.permissions : [];
      const normalizedTemplatePermissions = templatePermissions.filter((permission) =>
        EDITABLE_ORG_PERMISSIONS.includes(permission as (typeof EDITABLE_ORG_PERMISSIONS)[number]),
      );
      permissionsByRoleLabel.set(row.role_label, normalizedTemplatePermissions);
    }
    const permissionsByUserId = new Map<string, string[]>();
    for (const row of grantRows) {
      if (!EDITABLE_ORG_PERMISSIONS.includes(row.permission as (typeof EDITABLE_ORG_PERMISSIONS)[number])) continue;
      const list = permissionsByUserId.get(row.grantee_user_id) || [];
      if (!list.includes(row.permission)) list.push(row.permission);
      permissionsByUserId.set(row.grantee_user_id, list);
    }

    const rows = data.map((row) => {
      const email = row.member_user_id
        ? emailByUserId.get(row.member_user_id) || row.member_email || "unknown"
        : row.member_email || "unknown";
      const permissionsFromUserGrants = row.member_user_id ? permissionsByUserId.get(row.member_user_id) || [] : [];
      const permissionsFromRoleTemplate = permissionsByRoleLabel.get(row.role_label) || [];
      const permissions = permissionsFromUserGrants.length > 0 ? permissionsFromUserGrants : permissionsFromRoleTemplate;
      return { ...row, member_email: email, permissions };
    });

    return NextResponse.json(
      {
        data: rows,
        pagination: {
          limit,
          offset,
          total: Number(countRow?.count || 0),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load organization members.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });

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
    const normalizedPermissions = (permissions || []).filter((p) =>
      EDITABLE_ORG_PERMISSIONS.includes(p as (typeof EDITABLE_ORG_PERMISSIONS)[number]),
    );

    const target = await getAdminUserByEmail(normalizedEmail);
    if (target?.id === ownerId) {
      return NextResponse.json({ error: "Owner cannot add self as member." }, { status: 400 });
    }

    // Check if this email is already an active member of ANY organization
    const activeMembership = await queryNeonOne<{ org_owner_user_id: string }>(
      target?.id
        ? `SELECT org_owner_user_id
           FROM public.organization_members
           WHERE status = 'active'
             AND (member_email = $1 OR member_user_id = $2)
           LIMIT 1`
        : `SELECT org_owner_user_id
           FROM public.organization_members
           WHERE status = 'active'
             AND member_email = $1
           LIMIT 1`,
      target?.id ? [normalizedEmail, target.id] : [normalizedEmail],
    );

    if (activeMembership?.org_owner_user_id && activeMembership.org_owner_user_id !== ownerId) {
      return NextResponse.json(
        { error: "This user already belongs to another active organization." },
        { status: 409 },
      );
    }

    const timestamp = new Date().toISOString();
    const existingMemberRow = await queryNeonOne<{ id: string }>(
      `SELECT id
       FROM public.organization_members
       WHERE org_owner_user_id = $1
         AND lower(member_email) = lower($2)
       LIMIT 1`,
      [ownerId, normalizedEmail],
    );
    if (existingMemberRow?.id) {
      await queryNeon(
        `UPDATE public.organization_members
         SET member_user_id = $1,
             role_label = $2,
             status = 'active',
             updated_at = $3
         WHERE id = $4`,
        [target?.id || null, nextRoleLabel, timestamp, existingMemberRow.id],
      );
    } else {
      await queryNeon(
        `INSERT INTO public.organization_members
         (org_owner_user_id, member_email, member_user_id, role_label, status, updated_at)
         VALUES ($1, $2, $3, $4, 'active', $5)`,
        [ownerId, normalizedEmail, target?.id || null, nextRoleLabel, timestamp],
      );
    }

    const existingTemplateRow = await queryNeonOne<{ id: string }>(
      `SELECT id
       FROM public.organization_role_permission_templates
       WHERE org_owner_user_id = $1
         AND role_label = $2
       LIMIT 1`,
      [ownerId, nextRoleLabel],
    );
    if (existingTemplateRow?.id) {
      await queryNeon(
        `UPDATE public.organization_role_permission_templates
         SET permissions = $1::text[],
             updated_at = $2
         WHERE id = $3`,
        [normalizedPermissions, timestamp, existingTemplateRow.id],
      );
    } else {
      await queryNeon(
        `INSERT INTO public.organization_role_permission_templates
         (org_owner_user_id, role_label, permissions, updated_at)
         VALUES ($1, $2, $3::text[], $4)`,
        [ownerId, nextRoleLabel, normalizedPermissions, timestamp],
      );
    }

    if (target?.id) {
      try {
        await syncOrgMemberAccessGrantsFromTemplate(ownerId, target.id, nextRoleLabel);
      } catch (e: unknown) {
        console.error("Grant sync failed:", e);
      }
    }

    await ensureOrganizationMemberInviteColumns();
    const { raw: inviteRaw, hash: inviteHash } = createInviteRawToken();
    const inviteExpires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await queryNeon(
      `UPDATE public.organization_members
       SET invite_token_hash = $1,
           invite_token_expires_at = $2::timestamptz
       WHERE org_owner_user_id = $3
         AND lower(member_email) = lower($4)`,
      [inviteHash, inviteExpires, ownerId, normalizedEmail],
    );

    const ownerProfile = await queryNeonOne<{ organization_name: string | null }>(
      `SELECT organization_name FROM public.profiles WHERE id = $1 LIMIT 1`,
      [ownerId],
    );
    const organizationName = String(ownerProfile?.organization_name || "your organization");
    const acceptInviteUrl = `${getPublicAppUrl()}/invite/org-member?t=${encodeURIComponent(inviteRaw)}`;

    try {
      const invRes = await sendTeamMemberInviteEmail({
        to: normalizedEmail,
        organizationName,
        roleLabel: nextRoleLabel,
        acceptInviteUrl,
      });
      if (!invRes.sent) console.warn("[organization-members] invitee email skipped:", invRes.error);
    } catch (e: unknown) {
      console.error("[organization-members] invitee email failed:", e);
    }

    try {
      const ownerEmail = await getAdminUserEmailById(ownerId);
      if (ownerEmail) {
        const ownRes = await sendTeamMemberAddedOwnerNoticeEmail({
          ownerEmail,
          organizationName,
          memberEmail: normalizedEmail,
          roleLabel: nextRoleLabel,
        });
        if (!ownRes.sent) console.warn("[organization-members] owner notice skipped:", ownRes.error);
      }
    } catch (e: unknown) {
      console.error("[organization-members] owner notice failed:", e);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add organization member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
