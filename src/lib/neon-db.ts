import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function qIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function getConnectionString(): string {
  const value = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!value) {
    throw new Error("Missing DATABASE_URL/DATABASE_URL_DIRECT");
  }
  return value;
}

export function getNeonPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
      max: 10,
    });
  }
  return pool;
}

export async function queryNeon<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getNeonPool().query<T>(sql, params);
  return result.rows;
}

export async function queryNeonOne<T extends QueryResultRow = Record<string, unknown>>(
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
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map((k) => payload[k]);
  const sql = `INSERT INTO ${qIdent("public")}.${qIdent(table)} (${cols}) VALUES (${placeholders}) RETURNING ${returning};`;
  return queryNeonOne<Record<string, unknown>>(sql, values);
}

export async function updateRows(
  table: string,
  payload: Record<string, unknown>,
  where: Record<string, unknown>,
  returning = "*",
): Promise<Record<string, unknown>[]> {
  const dataKeys = Object.keys(payload);
  const whereKeys = Object.keys(where);
  if (dataKeys.length === 0 || whereKeys.length === 0) return [];

  const setSql = dataKeys
    .map((k, i) => `${qIdent(k)} = $${i + 1}`)
    .join(", ");
  const whereSql = whereKeys
    .map((k, i) => `${qIdent(k)} = $${dataKeys.length + i + 1}`)
    .join(" AND ");
  const values = [...dataKeys.map((k) => payload[k]), ...whereKeys.map((k) => where[k])];

  const sql = `UPDATE ${qIdent("public")}.${qIdent(table)} SET ${setSql} WHERE ${whereSql} RETURNING ${returning};`;
  return queryNeon<Record<string, unknown>>(sql, values);
}
