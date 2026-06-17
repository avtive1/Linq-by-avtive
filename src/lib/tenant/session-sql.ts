import type { TenantContext } from "@/lib/tenant/context";

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;\s*$/, "");
}

function shiftParamPlaceholders(sql: string, offset: number): string {
  return sql.replace(/\$(\d+)\b/g, (_, num) => `$${Number(num) + offset}`);
}

function isSelectQuery(sql: string): boolean {
  return /^\s*(WITH\s[\s\S]*?)?\s*SELECT\b/i.test(sql);
}

/**
 * Wraps a SELECT so session GUCs are set before the inner SQL runs.
 * Uses CROSS JOIN LATERAL so Postgres cannot elide the set_config CTE.
 */
function wrapSelectWithSessionPreamble(
  innerSql: string,
  preambleSelect: string,
  params: unknown[],
): { sql: string; params: unknown[] } {
  const sql = `
WITH _tenant_session AS (${preambleSelect})
SELECT _q.* FROM _tenant_session
CROSS JOIN LATERAL (
  ${innerSql}
) AS _q`;

  return { sql, params };
}

function wrapStatementWithSessionPreamble(
  innerSql: string,
  preambleSelect: string,
  params: unknown[],
): { sql: string; params: unknown[] } {
  const sql = `
WITH _tenant_session AS (${preambleSelect})
${innerSql}`;

  return { sql, params };
}

/**
 * Prefixes a parameterized query with session variables for PostgreSQL RLS.
 */
export function applyTenantSessionToQuery(
  sql: string,
  params: unknown[],
  context: TenantContext | null,
): { sql: string; params: unknown[] } {
  const innerSql = stripTrailingSemicolon(sql);

  if (!context) {
    return { sql: innerSql, params };
  }

  if (context.bypassRls) {
    const preamble = `SELECT set_config('app.bypass_rls', 'true', true) AS _x`;
    if (isSelectQuery(innerSql)) {
      return wrapSelectWithSessionPreamble(innerSql, preamble, params);
    }
    return wrapStatementWithSessionPreamble(innerSql, preamble, params);
  }

  if (!context.tenantId) {
    return { sql: innerSql, params };
  }

  const sessionParams: unknown[] = [context.tenantId];
  const setParts = [`set_config('app.current_tenant', $1, true)`];

  if (context.userId) {
    sessionParams.push(context.userId);
    setParts.push(`set_config('app.current_user', $${sessionParams.length}, true)`);
  }

  const offset = sessionParams.length;
  const shiftedSql = shiftParamPlaceholders(innerSql, offset);
  const preamble = `SELECT ${setParts.join(", ")} AS _x`;
  const mergedParams = [...sessionParams, ...params];

  if (isSelectQuery(innerSql)) {
    return wrapSelectWithSessionPreamble(shiftedSql, preamble, mergedParams);
  }

  return wrapStatementWithSessionPreamble(shiftedSql, preamble, mergedParams);
}
