import { ensurePerformanceIndexes } from "../../src/lib/db/ensure-performance-indexes";

async function main() {
  console.log("Applying performance indexes (idempotent)...");
  await ensurePerformanceIndexes();
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
