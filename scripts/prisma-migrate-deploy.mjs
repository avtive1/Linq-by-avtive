#!/usr/bin/env node
/**
 * Runs `prisma migrate deploy` against the direct (non-pooled) Neon URL when available.
 * Migrations require a direct Postgres connection; the pooler URL is a fallback only.
 */
import { spawnSync } from "node:child_process";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });


const databaseUrl =
  process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(
    "Missing DATABASE_URL_DIRECT or DATABASE_URL. Set one in .env or CI secrets.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  },
);

process.exit(result.status ?? 1);
