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

  console.log("=== Public indexes ===\n");
  let currentTable = "";
  for (const row of indexes) {
    const tablename = String(row.tablename || "");
    if (tablename !== currentTable) {
      currentTable = tablename;
      console.log(`\n[${currentTable}]`);
    }
    console.log(`  ${row.indexname}`);
  }

  console.log("\n=== FK columns possibly missing dedicated indexes ===\n");
  if (missingFkIndexes.length === 0) {
    console.log("None detected (or covered by composite indexes).");
  } else {
    for (const fk of missingFkIndexes) {
      console.log(
        `  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`,
      );
    }
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
  console.log(`\nInventory written to ${outPath.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
