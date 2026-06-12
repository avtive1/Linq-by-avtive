import fs from "node:fs";
import { Pool } from "pg";
import { neon } from "@neondatabase/serverless";
import { logger } from "./lib/logger.mjs";

function readEnvUrl(key) {
  const env = fs.readFileSync(".env.local", "utf8");
  const m = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${key}`);
  return m[1].trim();
}

function normalizeUrl(raw) {
  let url = raw
    .replace(/channel_binding=[^&]+&?/g, "")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
  if (!url.includes("uselibpqcompat=")) {
    url += `${url.includes("?") ? "&" : "?"}uselibpqcompat=true`;
  }
  if (!url.includes("sslmode=")) {
    url += `${url.includes("?") ? "&" : "?"}sslmode=require`;
  }
  return url;
}

async function testPg(label, url) {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  try {
    const result = await pool.query("SELECT 1 AS ok");
    logger.info({ label, rows: result.rows }, "pg connection test succeeded");
  } catch (error) {
    logger.error(
      { label, code: error.code, err: error },
      "pg connection test failed",
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function testNeonServerless(label, url) {
  const sql = neon(url);
  try {
    const result = await sql`SELECT 1 AS ok`;
    logger.info({ label, result }, "serverless connection test succeeded");
  } catch (error) {
    logger.error({ label, err: error }, "serverless connection test failed");
  }
}

const pooler = normalizeUrl(readEnvUrl("DATABASE_URL"));
const direct = normalizeUrl(readEnvUrl("DATABASE_URL_DIRECT"));

await testPg("pooler", pooler);
await testPg("direct", direct);
await testNeonServerless("pooler", pooler);
await testNeonServerless("direct", direct);
