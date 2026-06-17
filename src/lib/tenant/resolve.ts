import { queryNeonOneAsSystem } from "@/lib/neon-db";
import type { TenantContext } from "@/lib/tenant/context";

/**
 * Resolves the organization-owner user id that scopes tenant-owned data.
 * Org owners use their own id; active members use their org owner's id.
 */
export async function resolveOrgTenantIdForUser(userId: string): Promise<string> {
  const membership = await queryNeonOneAsSystem<{ org_owner_user_id: string }>(
    `SELECT org_owner_user_id
     FROM public.organization_members
     WHERE member_user_id = $1
       AND status = 'active'
     LIMIT 1`,
    [userId],
  );
  return membership?.org_owner_user_id || userId;
}

export async function buildTenantContextForUser(
  userId: string,
  options?: { bypassRls?: boolean },
): Promise<TenantContext> {
  const tenantId = await resolveOrgTenantIdForUser(userId);
  return {
    tenantId,
    userId,
    bypassRls: options?.bypassRls,
  };
}
