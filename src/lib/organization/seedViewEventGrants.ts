import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Grants read-only ("viewer") access to all campaigns owned by an organization owner.
 * This is intentionally conservative: it does NOT grant edit/delete/manage permissions.
 */
export async function seedViewEventGrantsForOrgMember(
  supabaseAdmin: SupabaseClient,
  orgOwnerUserId: string,
  memberUserId: string,
) {
  const { data: ownerEvents, error: eventsErr } = await supabaseAdmin.from("events").select("id").eq("user_id", orgOwnerUserId);
  if (eventsErr) throw eventsErr;

  const eventIds = (ownerEvents || []).map((e) => e.id).filter(Boolean);
  if (eventIds.length === 0) return;

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("access_grants")
    .select("event_id, permission")
    .in("event_id", eventIds)
    .eq("grantee_user_id", memberUserId)
    .eq("status", "active");
  if (existingErr) throw existingErr;

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

  const { error: insertErr } = await supabaseAdmin.from("access_grants").insert(rows);
  if (insertErr && insertErr.code !== "23505") {
    throw insertErr;
  }
}
