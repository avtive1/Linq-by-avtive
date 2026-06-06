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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = join(__dirname, "..");
loadEnvConfig(projectDir);

const CONCURRENT_QUERIES = parseInt(process.env.TEST_CONCURRENT_QUERIES || "20", 10);
const ITERATIONS = parseInt(process.env.TEST_ITERATIONS || "3", 10);

async function main() {
  console.log("=== Connection Pooling Test ===\n");

  // 1. Configuration check
  console.log("1. Configuration Check");
  const config = getDbPoolConfig();
  const connString = getConnectionString();
  const report = getConnectionLifecycleReport();

  console.log(`   - Using pooler URL: ${report.usingPoolerUrl ? "✅ YES" : "❌ NO"}`);
  console.log(`   - Connection source: ${report.connectionStringSource}`);
  console.log(`   - Max retries: ${config.maxRetries}`);
  console.log(`   - Retry backoff: ${config.retryBackoffMs}ms`);
  console.log(`   - Warn on direct URL: ${config.warnOnDirectUrl ? "Enabled" : "Disabled"}`);
  if (!report.usingPoolerUrl) {
    console.log("\n   ⚠️ WARNING: Not using Neon pooler URL!");
    console.log("      Check that DATABASE_URL contains '-pooler' in hostname\n");
  }

  // 2. Test query API
  console.log("\n2. Query API Test");
  try {
    const result = await queryNeon("SELECT 1 AS ok");
    console.log(`   - Query successful: ${result[0].ok === 1 ? "✅ YES" : "❌ NO"}`);
  } catch (err) {
    console.log(`   - Query failed: ${(err as Error).message}`);
  }

  // 3. Concurrent query test
  console.log(`\n3. Concurrent Query Test (${CONCURRENT_QUERIES} queries, ${ITERATIONS} iterations)`);

  async function runQuery(iteration: number, queryId: number) {
    const start = performance.now();
    try {
      const result = await queryNeon(
        "SELECT 1 AS ok, NOW() AS time, $1 AS iteration, $2 AS query_id",
        [iteration, queryId]
      );
      const duration = performance.now() - start;
      return { success: true, duration, result };
    } catch (err) {
      const duration = performance.now() - start;
      return { success: false, duration, error: (err as Error).message };
    }
  }

  async function runIteration(iteration: number) {
    console.log(`   Iteration ${iteration + 1}...`);
    const promises = [];
    for (let i = 0; i < CONCURRENT_QUERIES; i++) {
      promises.push(runQuery(iteration, i));
    }
    const results = await Promise.all(promises);
    
    const successes = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    console.log(`     - Success: ${successes}, Errors: ${errors}, Avg: ${avgDuration.toFixed(1)}ms`);
    return results;
  }

  const allResults: Array<{ success: boolean; duration: number }> = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const iterationResults = await runIteration(i);
    allResults.push(...iterationResults);
    // Small delay between iterations
    await new Promise(r => setTimeout(r, 500));
  }

  // 4. Summary
  console.log("\n=== Summary ===");
  const totalQueries = allResults.length;
  const totalSuccess = allResults.filter(r => r.success).length;
  const totalErrors = allResults.filter(r => !r.success).length;
  const allDurations = allResults.map(r => r.duration).sort((a, b) => a - b);
  const avgDuration = allDurations.reduce((a, b) => a + b, 0) / totalQueries;
  const p95 = allDurations[Math.ceil(0.95 * allDurations.length) - 1];
  const p99 = allDurations[Math.ceil(0.99 * allDurations.length) - 1];

  console.log(`Total queries: ${totalQueries}`);
  console.log(`Success: ${totalSuccess}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Average duration: ${avgDuration.toFixed(1)}ms`);
  console.log(`p95 duration: ${p95?.toFixed(1) || "N/A"}ms`);
  console.log(`p99 duration: ${p99?.toFixed(1) || "N/A"}ms`);

  // 5. Final check
  const finalReport = getConnectionLifecycleReport();
  console.log(`\nClient instantiated: ${finalReport.clientInstantiated ? "✅" : "❌"}`);

  if (totalErrors === 0 && finalReport.usingPoolerUrl) {
    console.log("\n✅ Connection pooling is working correctly!");
  } else if (totalErrors === 0) {
    console.log("\n✅ Queries work, but consider using Neon pooler URL for production.");
  } else {
    console.log("\n⚠️ Check configuration and Neon dashboard for errors.");
  }
}

main().catch(console.error);