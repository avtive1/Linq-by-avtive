import { ensurePerformanceIndexes } from "../../src/lib/db/ensure-performance-indexes";
import { logger } from "../lib/logger";

async function main() {
  logger.info("Applying performance indexes (idempotent)...");
  await ensurePerformanceIndexes();
  logger.info("Performance indexes applied");
}

main().catch((error) => {
  logger.error({ err: error instanceof Error ? error : undefined }, "Failed to apply performance indexes");
  process.exitCode = 1;
});
