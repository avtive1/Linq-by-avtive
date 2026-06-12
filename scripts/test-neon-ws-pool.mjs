import fs from "node:fs";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { logger } from "./lib/logger.mjs";

neonConfig.webSocketConstructor = ws;

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

const pool = new Pool({ connectionString: normalizeUrl(readEnvUrl("DATABASE_URL")) });
try {
  const result = await pool.query("SELECT 1 AS ok");
  logger.info({ rows: result.rows }, "WS pool connection test succeeded");
} catch (error) {
  logger.error({ code: error.code, err: error }, "WS pool connection test failed");
} finally {
  await pool.end();
}
