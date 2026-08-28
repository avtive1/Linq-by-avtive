#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const databaseUrl =
  process.env.DATABASE_URL_DIRECT?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("\n❌ Missing DATABASE_URL or DATABASE_URL_DIRECT.");
  console.error("Please add your PostgreSQL connection string to .env.local or .env:\n");
  console.error("DATABASE_URL=\"postgresql://postgres.<project-ref>:<password>@<host>:6543/postgres?pgbouncer=true\"\n");
  process.exit(1);
}

const args = process.argv.slice(2);
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npxCmd,
  ["prisma", "db", "push", ...args],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: true,
  },
);

if (result.error) {
  console.error("Failed to execute Prisma db push:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
