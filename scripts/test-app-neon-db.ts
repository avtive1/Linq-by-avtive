import { queryNeon } from "../src/lib/neon-db";
import { logger } from "./lib/logger";

async function main() {
  try {
    const rows = await queryNeon("SELECT 1 AS ok");
    logger.info({ rows }, "APP DB OK");
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    logger.error(
      { code: err.code, message: err.message || String(error) },
      "APP DB FAIL",
    );
    process.exitCode = 1;
  }
}

void main();
