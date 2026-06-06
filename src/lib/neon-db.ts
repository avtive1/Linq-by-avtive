import type { QueryResultRow } from "@neondatabase/serverless";
import {
  getConnectionLifecycleReport,
  getDbPoolConfig,
  getSqlClient,
  resetSqlClient,
} from "@/lib/db/pool";

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
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

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

export async function queryNeon<
  T extends QueryResultRow = Record<string, unknown>,
>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return runQueryWithRetry(async () => {
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
