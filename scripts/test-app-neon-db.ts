import { queryNeon } from "../src/lib/neon-db";

async function main() {
  try {
    const rows = await queryNeon("SELECT 1 AS ok");
    console.log("APP DB OK", rows);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error("APP DB FAIL", err.code || "", err.message || error);
    process.exitCode = 1;
  }
}

void main();
