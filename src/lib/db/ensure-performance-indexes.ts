import fs from "node:fs";
import path from "node:path";
import { queryNeon } from "@/lib/neon-db";

let indexesEnsured = false;
let ensurePromise: Promise<void> | null = null;

/**
 * Applies idempotent performance indexes from database/indexes/performance-indexes.sql.
 * Safe for production — every statement uses CREATE INDEX IF NOT EXISTS.
 */
export async function ensurePerformanceIndexes(): Promise<void> {
  if (indexesEnsured) return;
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    const sqlPath = path.join(
      process.cwd(),
      "database",
      "indexes",
      "performance-indexes.sql",
    );
    const raw = fs.readFileSync(sqlPath, "utf8");
    // Strip comments before splitting — semicolons inside `--` comments must not create statements.
    const withoutComments = raw.replace(/--[^\n]*/g, "");
    const statements = withoutComments
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await queryNeon(`${statement};`);
    }

    indexesEnsured = true;
  })().catch((error) => {
    ensurePromise = null;
    throw error;
  });

  await ensurePromise;
}

/** @internal Resets in-process guard (tests/scripts only). */
export function resetPerformanceIndexesGuard() {
  indexesEnsured = false;
  ensurePromise = null;
}
