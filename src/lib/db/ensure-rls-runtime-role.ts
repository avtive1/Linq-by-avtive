import { getSqlClient } from "@/lib/db/pool";

const DEFAULT_RLS_ROLE = "app_tenant_rls";

let ensurePromise: Promise<void> | null = null;

export function getRlsRuntimeRoleName(): string {
  return (process.env.DATABASE_RLS_ROLE || DEFAULT_RLS_ROLE).trim() || DEFAULT_RLS_ROLE;
}

function qIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function runOwnerBypassStatement(sql: string, params: unknown[] = []): Promise<void> {
  const client = getSqlClient();
  await client.transaction([
    client.query("SELECT set_config('app.bypass_rls', 'true', true)", []),
    client.query(sql.trim().replace(/;\s*$/, ""), params),
  ]);
}

/**
 * Ensures a NOBYPASSRLS runtime role exists for tenant-scoped queries.
 * Neon owner roles bypass RLS even when FORCE ROW LEVEL SECURITY is enabled.
 */
export async function ensureRlsRuntimeRole(): Promise<void> {
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    const role = getRlsRuntimeRoleName();
    const roleIdent = qIdent(role);

    await runOwnerBypassStatement(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role.replace(/'/g, "''")}') THEN
           CREATE ROLE ${roleIdent} NOBYPASSRLS;
         END IF;
       END $$`,
    );

    await runOwnerBypassStatement(`GRANT USAGE ON SCHEMA public TO ${roleIdent}`);
    await runOwnerBypassStatement(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roleIdent}`,
    );
    await runOwnerBypassStatement(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${roleIdent}`);
    await runOwnerBypassStatement(`GRANT ${roleIdent} TO CURRENT_USER`);
  })();

  await ensurePromise;
}
