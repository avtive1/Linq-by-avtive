import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { seedViewEventGrantsForOrgMember } from "@/lib/organization/seedViewEventGrants";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { getAdminUserByEmail } from "@/lib/admin";
import { validateCsrfOrigin } from "@/lib/security/csrf";

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
          `SELECT grantee_user_id, permission
           FROM public.access_grants
           WHERE grantee_user_id = ANY($1::uuid[])
             AND status = 'active'`,
          [userIds],
        )
      : [];
    const permissionsByUserId = new Map<string, string[]>();
    for (const row of grantRows) {
      const list = permissionsByUserId.get(row.grantee_user_id) || [];
      if (!list.includes(row.permission)) list.push(row.permission);
      permissionsByUserId.set(row.grantee_user_id, list);
    }

    const rows = data.map((row) => {
      const email = row.member_user_id
        ? emailByUserId.get(row.member_user_id) || row.member_email || "unknown"
        : row.member_email || "unknown";
      const permissions = row.member_user_id ? permissionsByUserId.get(row.member_user_id) || [] : [];
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
    const allowedPermissions = ["create_event", "manage_event", "edit_cards", "delete_cards"];
    const normalizedPermissions = (permissions || []).filter((p) => allowedPermissions.includes(p));

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

    // Upsert the membership based on org_owner_user_id and member_email
    await queryNeon(
      `INSERT INTO public.organization_members
       (org_owner_user_id, member_email, member_user_id, role_label, status, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (org_owner_user_id, member_email)
       DO UPDATE SET
         member_user_id = EXCLUDED.member_user_id,
         role_label = EXCLUDED.role_label,
         status = 'active',
         updated_at = EXCLUDED.updated_at`,
      [ownerId, normalizedEmail, target?.id || null, nextRoleLabel, new Date().toISOString()],
    );

    // If user exists, seed default view grants
    if (target?.id) {
      try {
        await seedViewEventGrantsForOrgMember(ownerId, target.id);
      } catch (e: unknown) {
        // Log but don't fail the whole request
        console.error("Grant seeding failed:", e);
      }
    }

    await queryNeon(
      `INSERT INTO public.organization_role_permission_templates
       (org_owner_user_id, role_label, permissions, updated_at)
       VALUES ($1, $2, $3::text[], $4)
       ON CONFLICT (org_owner_user_id, role_label)
       DO UPDATE SET
         permissions = EXCLUDED.permissions,
         updated_at = EXCLUDED.updated_at`,
      [ownerId, nextRoleLabel, normalizedPermissions, new Date().toISOString()],
    );

    if (normalizedPermissions.length > 0 && target?.id) {
      const ownerEvents = await queryNeon<{ id: string }>(
        `SELECT id FROM public.events WHERE user_id = $1`,
        [ownerId],
      );
      const eventIds = ownerEvents.map((e) => e.id);
      if (eventIds.length > 0) {
        const existing = await queryNeon<{ event_id: string; permission: string }>(
          `SELECT event_id, permission
           FROM public.access_grants
           WHERE event_id = ANY($1::uuid[])
             AND grantee_user_id = $2
             AND status = 'active'`,
          [eventIds, target.id],
        );
        const existingSet = new Set(existing.map((g) => `${g.event_id}:${g.permission}`));
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
          await queryNeon(
            `INSERT INTO public.access_grants (event_id, grantee_user_id, granted_by_user_id, permission, status)
             SELECT x.event_id::uuid, $1::uuid, $2::uuid, x.permission::text, x.status::text
             FROM jsonb_to_recordset($3::jsonb) AS x(event_id text, permission text, status text)
             ON CONFLICT DO NOTHING`,
            [target.id, ownerId, JSON.stringify(toInsert)],
          );
        }
      }
    }

    const targetEmail = target?.emailAddresses?.[0]?.emailAddress;
    if (targetEmail) {
      await sendTransactionalEmail({
        to: targetEmail,
        subject: "You were granted organization access",
        text:
          `You were added to an organization with role "${nextRoleLabel}".\n\n` +
          `Default permissions: ${normalizedPermissions.length ? normalizedPermissions.join(", ") : "none"}\n\n` +
          `Sign in to your dashboard to continue.`,
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add organization member.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
