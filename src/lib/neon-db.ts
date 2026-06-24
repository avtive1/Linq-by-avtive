import type { QueryResultRow } from "@neondatabase/serverless";
import {
  getDbPoolConfig,
  getSqlClient,
  resetSqlClient,
} from "@/lib/db/pool";
import { ensureRlsRuntimeRole, getRlsRuntimeRoleName } from "@/lib/db/ensure-rls-runtime-role";
import { getTenantContext, runWithTenantContextAsync, type TenantContext } from "@/lib/tenant/context";

export {
  getConnectionLifecycleReport,
  getDbPoolConfig,
  getConnectionString,
} from "@/lib/db/pool";

const TRANSIENT_DB_ERROR_CODES = [
  "fetch failed",
  "connection terminated",
  "timeout",
  "socket",
  "network",
  "econnreset",
  "etimedout",
];

function qIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientDbError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  return TRANSIENT_DB_ERROR_CODES.some((code) =>
    message.includes(code.toLowerCase()),
  );
}

/**
 * Compatibility no-op — resets singleton client after transient failures.
 */
export async function resetNeonPool(): Promise<void> {
  await resetSqlClient();
}

/**
 * Compatibility wrapper — delegates to singleton HTTP client (Neon pooler handles TCP pooling).
 */
export function getNeonPool() {
  return {
    query: async <T extends QueryResultRow>(
      query: string,
      params: unknown[] = [],
    ) => {
      const result = await getSqlClient().query(query, params);

      return {
        rows: result as T[],
      };
    },
  };
}

async function runQueryWithRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const { maxRetries, retryBackoffMs } = getDbPoolConfig();
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (
        !isTransientDbError(error) ||
        attempt === maxRetries
      ) {
        throw new Error(
          error instanceof Error
            ? error.message
            : "Database query failed",
        );
      }

      await resetNeonPool();
      await sleep(retryBackoffMs * attempt);
    }
  }

  throw new Error("Database query failed");
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;\s*$/, "");
}

function tenantSessionQueries(context: TenantContext, sql: string, params: unknown[]) {
  const client = getSqlClient();
  const statement = stripTrailingSemicolon(sql);
  const rlsRole = getRlsRuntimeRoleName();

  if (context.bypassRls) {
    return [
      client.query("SELECT set_config('app.bypass_rls', 'true', true)", []),
      client.query(statement, params),
    ];
  }

  const scoped = [
    client.query(`SET LOCAL ROLE ${rlsRole}`, []),
    client.query("SELECT set_config('app.current_tenant', $1, true)", [context.tenantId]),
  ];
  if (context.userId) {
    scoped.push(client.query("SELECT set_config('app.current_user', $1, true)", [context.userId]));
  }
  scoped.push(client.query(statement, params));
  return scoped;
}

function rowsFromTransactionResult(result: unknown): Record<string, unknown>[] {
  return Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
}

export async function queryNeon<
  T extends QueryResultRow = Record<string, unknown>,
>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return runQueryWithRetry(async () => {
    const context = getTenantContext();

    if (context && (context.bypassRls || context.tenantId)) {
      if (!context.bypassRls && context.tenantId) {
        await ensureRlsRuntimeRole();
      }

      const results = await getSqlClient().transaction(
        tenantSessionQueries(context, sql, params),
      );
      const last = results[results.length - 1];
      return rowsFromTransactionResult(last) as T[];
    }

    const result = await getNeonPool().query<T>(
      sql,
      params,
    );

    return result.rows;
  });
}

export async function queryNeonOne<
  T extends QueryResultRow = Record<string, unknown>,
>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await queryNeon<T>(sql, params);

  return rows[0] || null;
}

const SYSTEM_TENANT_CONTEXT = { tenantId: "", userId: "", bypassRls: true as const };

/** Bypass RLS — auth, migrations, and explicitly public token-gated reads only. */
export async function queryNeonAsSystem<
  T extends QueryResultRow = Record<string, unknown>,
>(sql: string, params: unknown[] = []): Promise<T[]> {
  return runWithTenantContextAsync(SYSTEM_TENANT_CONTEXT, () => queryNeon<T>(sql, params));
}

export async function queryNeonOneAsSystem<
  T extends QueryResultRow = Record<string, unknown>,
>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await queryNeonAsSystem<T>(sql, params);
  return rows[0] || null;
}

export async function runWithRlsBypassAsync<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenantContextAsync(SYSTEM_TENANT_CONTEXT, fn);
}

export async function insertRow(
  table: string,
  payload: Record<string, unknown>,
  returning = "*",
): Promise<Record<string, unknown> | null> {
  const keys = Object.keys(payload);

  if (keys.length === 0) return null;

  const cols = keys.map(qIdent).join(", ");

  const placeholders = keys
    .map((_, i) => `$${i + 1}`)
    .join(", ");

  const values = keys.map((k) => payload[k]);

  const sql = `
    INSERT INTO ${qIdent("public")}.${qIdent(table)}
    (${cols})
    VALUES (${placeholders})
    RETURNING ${returning};
  `;

  return queryNeonOne<Record<string, unknown>>(
    sql,
    values,
  );
}

export async function updateRows(
  table: string,
  payload: Record<string, unknown>,
  where: Record<string, unknown>,
  returning = "*",
): Promise<Record<string, unknown>[]> {
  const dataKeys = Object.keys(payload);

  const whereKeys = Object.keys(where);

  if (
    dataKeys.length === 0 ||
    whereKeys.length === 0
  ) {
    return [];
  }

  const setSql = dataKeys
    .map((k, i) => `${qIdent(k)} = $${i + 1}`)
    .join(", ");

  const whereSql = whereKeys
    .map(
      (k, i) =>
        `${qIdent(k)} = $${dataKeys.length + i + 1}`,
    )
    .join(" AND ");

  const values = [
    ...dataKeys.map((k) => payload[k]),
    ...whereKeys.map((k) => where[k]),
  ];

  const sql = `
    UPDATE ${qIdent("public")}.${qIdent(table)}
    SET ${setSql}
    WHERE ${whereSql}
    RETURNING ${returning};
  `;

  return queryNeon<Record<string, unknown>>(
    sql,
    values,
  );
}

/**
 * Run EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) for query plan auditing.
 * Use only in scripts/diagnostics — executes the query.
 */
export async function explainAnalyzeQuery(
  sql: string,
  params: unknown[] = [],
): Promise<unknown> {
  const rows = await queryNeon<{ "QUERY PLAN": unknown }>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
    params,
  );
  return rows[0]?.["QUERY PLAN"] ?? rows;
}
