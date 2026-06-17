import { queryNeon, updateRows } from "@/lib/neon-db";

/** Direct tenant column on tenant-owned tables (org owner user id). */
export const TENANT_COLUMN_BY_TABLE: Record<string, string> = {
  events: "user_id",
  organizations: "owner_user_id",
  organization_members: "org_owner_user_id",
  organization_role_permission_templates: "org_owner_user_id",
  organization_join_requests: "owner_user_id",
  access_requests: "owner_user_id",
  registration_requests: "organization_id",
};

export function assertTenantColumn(table: string): string {
  const column = TENANT_COLUMN_BY_TABLE[table];
  if (!column) {
    throw new Error(`No tenant column mapping for table "${table}". Use a scoped helper.`);
  }
  return column;
}

export async function updateTenantRows(
  table: string,
  payload: Record<string, unknown>,
  where: Record<string, unknown>,
  tenantId: string,
  returning = "*",
): Promise<Record<string, unknown>[]> {
  const tenantColumn = assertTenantColumn(table);
  return updateRows(table, payload, { ...where, [tenantColumn]: tenantId }, returning);
}

export async function deleteTenantRows(
  table: string,
  where: Record<string, unknown>,
  tenantId: string,
  returning = "id",
): Promise<Record<string, unknown>[]> {
  const tenantColumn = assertTenantColumn(table);
  const keys = Object.keys(where);
  if (!keys.length) return [];

  const whereSql = keys.map((k, i) => `"${k.replace(/"/g, '""')}" = $${i + 2}`).join(" AND ");
  const values = [tenantId, ...keys.map((k) => where[k])];

  const sql = `
    DELETE FROM "public"."${table.replace(/"/g, '""')}"
    WHERE "${tenantColumn.replace(/"/g, '""')}" = $1
      AND ${whereSql}
    RETURNING ${returning};
  `;

  return queryNeon<Record<string, unknown>>(sql, values);
}

export async function deleteAttendeeForTenant(
  attendeeId: string,
  tenantId: string,
): Promise<boolean> {
  const rows = await queryNeon<{ id: string }>(
    `DELETE FROM public.attendees a
     WHERE a.id = $1
       AND (
         a.user_id = $2::uuid
         OR EXISTS (
           SELECT 1
           FROM public.events e
           WHERE e.id = a.event_id
             AND e.user_id = $2::uuid
         )
       )
     RETURNING a.id`,
    [attendeeId, tenantId],
  );
  return rows.length > 0;
}

export async function updateAttendeeForTenant(
  attendeeId: string,
  tenantId: string,
  payload: Record<string, unknown>,
  returning = "*",
): Promise<Record<string, unknown>[]> {
  const keys = Object.keys(payload);
  if (!keys.length) return [];

  const setSql = keys.map((k, i) => `"${k.replace(/"/g, '""')}" = $${i + 3}`).join(", ");
  const values = [attendeeId, tenantId, ...keys.map((k) => payload[k])];

  const sql = `
    UPDATE public.attendees a
    SET ${setSql}
    WHERE a.id = $1
      AND (
        a.user_id = $2::uuid
        OR EXISTS (
          SELECT 1
          FROM public.events e
          WHERE e.id = a.event_id
            AND e.user_id = $2::uuid
        )
      )
    RETURNING ${returning};
  `;

  return queryNeon<Record<string, unknown>>(sql, values);
}

export async function updateAccessGrantForTenant(
  grantId: string,
  tenantId: string,
  payload: Record<string, unknown>,
  returning = "id",
): Promise<Record<string, unknown>[]> {
  const keys = Object.keys(payload);
  if (!keys.length) return [];

  const setSql = keys.map((k, i) => `"${k.replace(/"/g, '""')}" = $${i + 3}`).join(", ");
  const values = [grantId, tenantId, ...keys.map((k) => payload[k])];

  const sql = `
    UPDATE public.access_grants g
    SET ${setSql}
    WHERE g.id = $1
      AND (
        g.granted_by_user_id = $2::uuid
        OR EXISTS (
          SELECT 1
          FROM public.events e
          WHERE e.id = g.event_id
            AND e.user_id = $2::uuid
        )
      )
    RETURNING ${returning};
  `;

  return queryNeon<Record<string, unknown>>(sql, values);
}
