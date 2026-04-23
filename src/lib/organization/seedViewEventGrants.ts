import { queryNeon } from "@/lib/neon-db";

/**
 * Grants read-only ("viewer") access to all campaigns owned by an organization owner.
 * This is intentionally conservative: it does NOT grant edit/delete/manage permissions.
 */
export async function seedViewEventGrantsForOrgMember(
  orgOwnerUserId: string,
  memberUserId: string,
) {
  const ownerEvents = await queryNeon<{ id: string }>(
    `SELECT id FROM public.events WHERE user_id = $1`,
    [orgOwnerUserId],
  );
  const eventIds = ownerEvents.map((e) => e.id).filter(Boolean);
  if (eventIds.length === 0) return;

  const existing = await queryNeon<{ event_id: string; permission: string }>(
    `SELECT event_id, permission
     FROM public.access_grants
     WHERE event_id = ANY($1::uuid[])
       AND grantee_user_id = $2
       AND status = 'active'`,
    [eventIds, memberUserId],
  );

  const existingSet = new Set((existing || []).map((g: { event_id: string; permission: string }) => `${g.event_id}:${g.permission}`));

  const rows = eventIds
    .filter((eventId) => !existingSet.has(`${eventId}:view_event`))
    .map((eventId) => ({
      event_id: eventId,
      grantee_user_id: memberUserId,
      granted_by_user_id: orgOwnerUserId,
      permission: "view_event",
      status: "active",
    }));

  if (rows.length === 0) return;

  await queryNeon(
    `INSERT INTO public.access_grants (event_id, grantee_user_id, granted_by_user_id, permission, status)
     SELECT x.event_id::uuid, $1::uuid, $2::uuid, x.permission::text, 'active'::text
     FROM jsonb_to_recordset($3::jsonb) AS x(event_id text, permission text)
     ON CONFLICT DO NOTHING`,
    [memberUserId, orgOwnerUserId, JSON.stringify(rows)],
  );
}
