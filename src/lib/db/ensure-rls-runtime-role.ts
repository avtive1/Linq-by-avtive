const DEFAULT_RLS_ROLE = "app_tenant_rls";

export function getRlsRuntimeRoleName(): string {
  const configuredRole = process.env.DATABASE_RLS_ROLE?.trim();
  if (configuredRole && configuredRole !== DEFAULT_RLS_ROLE) {
    throw new Error(
      `DATABASE_RLS_ROLE must be ${DEFAULT_RLS_ROLE}; custom runtime roles must be provisioned by a migration.`,
    );
  }
  return DEFAULT_RLS_ROLE;
}

/**
 * The role is provisioned by migration 20260731000000.
 * Request handlers must never create roles or grant database privileges.
 */
export async function ensureRlsRuntimeRole(): Promise<void> {
  return;
}
