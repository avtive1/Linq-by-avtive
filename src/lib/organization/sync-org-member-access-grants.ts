import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { seedViewEventGrantsForOrgMember } from "@/lib/organization/seedViewEventGrants";

const EDITABLE_ORG_PERMISSIONS = ["create_event", "manage_event", "edit_cards", "delete_cards"] as const;

/**
 * Applies stored role-template permissions to grants for a concrete member user id.
 * Used when the member already existed at invite time, or after lazy-link / invite acceptance.
 */
export async function syncOrgMemberAccessGrantsFromTemplate(
  ownerId: string,
  memberUserId: string,
  roleLabel: string,
): Promise<void> {
  await seedViewEventGrantsForOrgMember(ownerId, memberUserId);

  const templateRow = await queryNeonOne<{ permissions: string[] | null }>(
    `SELECT permissions
     FROM public.organization_role_permission_templates
     WHERE org_owner_user_id = $1
       AND role_label = $2
     LIMIT 1`,
    [ownerId, roleLabel],
  );
  const normalizedPermissions = (Array.isArray(templateRow?.permissions) ? templateRow.permissions : []).filter(
    (p): p is (typeof EDITABLE_ORG_PERMISSIONS)[number] =>
      EDITABLE_ORG_PERMISSIONS.includes(p as (typeof EDITABLE_ORG_PERMISSIONS)[number]),
  );

  if (normalizedPermissions.length > 0) {
    await queryNeon(
      `DELETE FROM public.access_grants
       WHERE event_id IS NULL
         AND granted_by_user_id = $1
         AND grantee_user_id = $2
         AND permission = ANY($3::text[])
         AND permission <> ALL($4::text[])`,
      [ownerId, memberUserId, EDITABLE_ORG_PERMISSIONS, normalizedPermissions],
    );
  } else {
    await queryNeon(
      `DELETE FROM public.access_grants
       WHERE event_id IS NULL
         AND granted_by_user_id = $1
         AND grantee_user_id = $2
         AND permission = ANY($3::text[])`,
      [ownerId, memberUserId, EDITABLE_ORG_PERMISSIONS],
    );
  }

  const existingOrgLevel = await queryNeon<{ permission: string }>(
    `SELECT permission
     FROM public.access_grants
     WHERE event_id IS NULL
       AND granted_by_user_id = $1
       AND grantee_user_id = $2
       AND status = 'active'
       AND permission = ANY($3::text[])`,
    [ownerId, memberUserId, normalizedPermissions],
  );
  const existingOrgPermissionSet = new Set(existingOrgLevel.map((row) => row.permission));
  const orgLevelToInsert = normalizedPermissions
    .filter((permission) => !existingOrgPermissionSet.has(permission))
    .map((permission) => ({
      grantee_user_id: memberUserId,
      granted_by_user_id: ownerId,
      permission,
      status: "active",
    }));
  if (orgLevelToInsert.length > 0) {
    await queryNeon(
      `INSERT INTO public.access_grants (event_id, grantee_user_id, granted_by_user_id, permission, status)
       SELECT NULL::uuid, x.grantee_user_id::uuid, x.granted_by_user_id::uuid, x.permission::text, x.status::text
       FROM jsonb_to_recordset($1::jsonb) AS x(grantee_user_id text, granted_by_user_id text, permission text, status text)
       ON CONFLICT DO NOTHING`,
      [JSON.stringify(orgLevelToInsert)],
    );
  }

  const ownerEvents = await queryNeon<{ id: string }>(`SELECT id FROM public.events WHERE user_id = $1`, [ownerId]);
  const eventIds = ownerEvents.map((e) => e.id);
  if (eventIds.length > 0) {
    if (normalizedPermissions.length > 0) {
      await queryNeon(
        `DELETE FROM public.access_grants
         WHERE event_id = ANY($1::uuid[])
           AND grantee_user_id = $2
           AND permission = ANY($3::text[])
           AND permission <> ALL($4::text[])`,
        [eventIds, memberUserId, EDITABLE_ORG_PERMISSIONS, normalizedPermissions],
      );
    } else {
      await queryNeon(
        `DELETE FROM public.access_grants
         WHERE event_id = ANY($1::uuid[])
           AND grantee_user_id = $2
           AND permission = ANY($3::text[])`,
        [eventIds, memberUserId, EDITABLE_ORG_PERMISSIONS],
      );
    }

    const existing = await queryNeon<{ event_id: string; permission: string }>(
      `SELECT event_id, permission
       FROM public.access_grants
       WHERE event_id = ANY($1::uuid[])
         AND grantee_user_id = $2
         AND status = 'active'`,
      [eventIds, memberUserId],
    );
    const existingSet = new Set(existing.map((g) => `${g.event_id}:${g.permission}`));
    const toInsert: Array<Record<string, unknown>> = [];
    for (const eventId of eventIds) {
      for (const permission of normalizedPermissions) {
        const key = `${eventId}:${permission}`;
        if (existingSet.has(key)) continue;
        toInsert.push({
          event_id: eventId,
          grantee_user_id: memberUserId,
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
        [memberUserId, ownerId, JSON.stringify(toInsert)],
      );
    }
  }
}
