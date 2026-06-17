#!/usr/bin/env node
/**
 * One-time baselining for an existing production database that predates Prisma Migrate.
 * Marks the baseline migration as applied without executing its SQL.
 *
 * Usage (with direct DB URL): npm run db:migrate:baseline
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

const migrationName = "20250615120000_baseline";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "resolve", "--applied", migrationName],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  },
);

process.exit(result.status ?? 1);
