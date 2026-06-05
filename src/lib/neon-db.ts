import {
  neon,
  type NeonQueryFunction,
  type QueryResultRow,
} from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;

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
 * Prefer pooled Neon URL if available.
 */
function getConnectionString(): string {
  let value =
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_DIRECT;

  if (!value) {
    throw new Error(
      "Missing DATABASE_URL/DATABASE_URL_DIRECT",
    );
  }

  if (
    value.includes("postgresql://") ||
    value.includes("postgres://")
  ) {
    value = value
      .replace(/channel_binding=[^&]+&?/g, "")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");

    if (!value.includes("sslmode=")) {
      const separator = value.includes("?") ? "&" : "?";
      value = `${value}${separator}sslmode=require`;
    } else {
      value = value.replace(
        /sslmode=[^&]+/g,
        "sslmode=require",
      );
    }
  }

  return value;
}

function getSql() {
  if (!sqlClient) {
    sqlClient = neon(getConnectionString());
  }

  return sqlClient;
}

/**
 * Compatibility no-op
 */
export async function resetNeonPool(): Promise<void> {
  sqlClient = null;
}

/**
 * Compatibility wrapper
 */
export function getNeonPool() {
  return {
    query: async <T extends QueryResultRow>(
      query: string,
      params: unknown[] = [],
    ) => {
      const result = await getSql().query(query, params);

      return {
        rows: result as T[],
      };
    },
  };
}

async function runQueryWithRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      if (
        !isTransientDbError(error) ||
        attempt === maxAttempts
      ) {
        throw new Error(
          error instanceof Error
            ? error.message
            : "Database query failed",
        );
      }

      await resetNeonPool();

      await sleep(150 * attempt);
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
        `${qIdent(k)} = $${
          dataKeys.length + i + 1
        }`,
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