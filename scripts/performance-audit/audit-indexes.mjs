import { logger } from "../lib/logger.mjs";

/**
 * Lists indexes on public tables and flags likely FK columns without indexes.
 */
async function main() {
  const { queryNeon } = await import("../../src/lib/neon-db.ts");

  const indexes = await queryNeon(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
     ORDER BY tablename, indexname`,
  );

  const fkColumns = await queryNeon(
    `SELECT
       tc.table_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
     ORDER BY tc.table_name, kcu.column_name`,
  );

  const indexDefsLower = indexes.map((i) => String(i.indexdef || "").toLowerCase());
  const missingFkIndexes = fkColumns.filter((fk) => {
    const col = String(fk.column_name || "").toLowerCase();
    const table = String(fk.table_name || "").toLowerCase();
    return !indexDefsLower.some(
      (def) => def.includes(`(${col}`) && def.includes(table),
    );
  });

  const indexesByTable = {};
  for (const row of indexes) {
    const tablename = String(row.tablename || "");
    if (!indexesByTable[tablename]) indexesByTable[tablename] = [];
    indexesByTable[tablename].push(String(row.indexname || ""));
  }

  logger.info({ indexesByTable, indexCount: indexes.length }, "Public index inventory");

  if (missingFkIndexes.length === 0) {
    logger.info("No FK columns missing dedicated indexes detected");
  } else {
    logger.warn({ missingFkIndexes }, "FK columns possibly missing dedicated indexes");
  }

  const outPath = new URL("./index-inventory.json", import.meta.url);
  const fs = await import("node:fs/promises");
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        indexCount: indexes.length,
        indexes,
        foreignKeys: fkColumns,
        missingFkIndexes,
      },
      null,
      2,
    ),
  );
  logger.info({ outPath: outPath.pathname }, "Index inventory written");
}

main().catch((error) => {
  logger.error({ err: error }, "Index audit failed");
  process.exitCode = 1;
});
