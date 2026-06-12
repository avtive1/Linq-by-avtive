// Connection pooling test script
// Usage: npx tsx scripts/test-connection-pool.ts

import { performance } from "node:perf_hooks";
import { loadEnvConfig } from "@next/env";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getConnectionLifecycleReport,
  getDbPoolConfig,
  getConnectionString,
} from "../src/lib/db/pool";
import { queryNeon } from "../src/lib/neon-db";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = join(__dirname, "..");
loadEnvConfig(projectDir);

const CONCURRENT_QUERIES = parseInt(process.env.TEST_CONCURRENT_QUERIES || "20", 10);
const ITERATIONS = parseInt(process.env.TEST_ITERATIONS || "3", 10);

async function main() {
  logger.info("Connection pooling test started");

  const config = getDbPoolConfig();
  getConnectionString();
  const report = getConnectionLifecycleReport();

  logger.info({
    usingPoolerUrl: report.usingPoolerUrl,
    connectionSource: report.connectionStringSource,
    maxRetries: config.maxRetries,
    retryBackoffMs: config.retryBackoffMs,
    warnOnDirectUrl: config.warnOnDirectUrl,
  }, "Configuration check");

  if (!report.usingPoolerUrl) {
    logger.warn("Not using Neon pooler URL; check DATABASE_URL contains '-pooler' in hostname");
  }

  try {
    const result = await queryNeon("SELECT 1 AS ok");
    logger.info({ ok: result[0].ok === 1 }, "Query API test");
  } catch (err) {
    logger.error({ err }, "Query API test failed");
  }

  logger.info({ concurrentQueries: CONCURRENT_QUERIES, iterations: ITERATIONS }, "Starting concurrent query test");

  async function runQuery(iteration: number, queryId: number) {
    const start = performance.now();
    try {
      await queryNeon(
        "SELECT 1 AS ok, NOW() AS time, $1 AS iteration, $2 AS query_id",
        [iteration, queryId]
      );
      const duration = performance.now() - start;
      return { success: true, duration };
    } catch (err) {
      const duration = performance.now() - start;
      return { success: false, duration, error: (err as Error).message };
    }
  }

  async function runIteration(iteration: number) {
    const promises = [];
    for (let i = 0; i < CONCURRENT_QUERIES; i++) {
      promises.push(runQuery(iteration, i));
    }
    const results = await Promise.all(promises);

    const successes = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    logger.info({
      iteration: iteration + 1,
      successes,
      errors,
      avgDurationMs: Number(avgDuration.toFixed(1)),
    }, "Concurrent query iteration complete");
    return results;
  }

  const allResults: Array<{ success: boolean; duration: number }> = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const iterationResults = await runIteration(i);
    allResults.push(...iterationResults);
    await new Promise(r => setTimeout(r, 500));
  }

  const totalQueries = allResults.length;
  const totalSuccess = allResults.filter(r => r.success).length;
  const totalErrors = allResults.filter(r => !r.success).length;
  const allDurations = allResults.map(r => r.duration).sort((a, b) => a - b);
  const avgDuration = allDurations.reduce((a, b) => a + b, 0) / totalQueries;
  const p95 = allDurations[Math.ceil(0.95 * allDurations.length) - 1];
  const p99 = allDurations[Math.ceil(0.99 * allDurations.length) - 1];

  const finalReport = getConnectionLifecycleReport();

  logger.info({
    totalQueries,
    totalSuccess,
    totalErrors,
    avgDurationMs: Number(avgDuration.toFixed(1)),
    p95DurationMs: p95 ? Number(p95.toFixed(1)) : null,
    p99DurationMs: p99 ? Number(p99.toFixed(1)) : null,
    clientInstantiated: finalReport.clientInstantiated,
    usingPoolerUrl: finalReport.usingPoolerUrl,
  }, "Connection pooling test summary");

  if (totalErrors === 0 && finalReport.usingPoolerUrl) {
    logger.info("Connection pooling is working correctly");
  } else if (totalErrors === 0) {
    logger.warn("Queries work, but consider using Neon pooler URL for production");
  } else {
    logger.warn("Check configuration and Neon dashboard for errors");
  }
}

main().catch((err) => {
  logger.error({ err }, "Connection pooling test failed");
  process.exitCode = 1;
});
