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
// Local development commonly keeps the direct Neon URL in .env.local.
// CI-provided environment variables still win because dotenv does not override them.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
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
  process.execPath,
  [path.resolve(__dirname, "../node_modules/prisma/build/index.js"), "migrate", "deploy"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  },
);

if (result.error) {
  console.error("Failed to start Prisma migration process:", result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`Prisma migration process terminated by signal ${result.signal}.`);
  process.exit(1);
}

process.exit(result.status ?? 1);
