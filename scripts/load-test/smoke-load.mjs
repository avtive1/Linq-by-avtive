import { performance } from "node:perf_hooks";
import { logger } from "../lib/logger.mjs";

const BASE = process.env.LOAD_TEST_BASE_URL || "http://localhost:3000";
const DURATION_SEC = Number(process.env.LOAD_TEST_DURATION_SEC || 30);
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || 10);

const SCENARIOS = [
  { name: "health_session", path: "/api/auth/session", method: "GET" },
  { name: "public_event_short", path: "/ev/testslug", method: "GET", expectRedirect: true },
];

function createStats() {
  return { count: 0, errors: 0, totalMs: 0, latencies: [] };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runRequest(scenario) {
  const started = performance.now();
  const res = await fetch(`${BASE}${scenario.path}`, {
    method: scenario.method,
    headers: { Accept: "application/json" },
    redirect: scenario.expectRedirect ? "manual" : "follow",
  });
  const elapsed = performance.now() - started;
  const ok = scenario.expectRedirect
    ? res.status >= 300 && res.status < 400
    : res.status < 500;
  if (!ok) throw new Error(`${scenario.name} -> ${res.status}`);
  return elapsed;
}

async function worker(scenario, stats, endAt) {
  while (performance.now() < endAt) {
    try {
      const ms = await runRequest(scenario);
      stats.count += 1;
      stats.totalMs += ms;
      stats.latencies.push(ms);
    } catch {
      stats.errors += 1;
    }
  }
}

async function main() {
  logger.info({ base: BASE, durationSec: DURATION_SEC, concurrency: CONCURRENCY }, "Load test started");
  const endAt = performance.now() + DURATION_SEC * 1000;
  const allStats = {};

  for (const scenario of SCENARIOS) {
    allStats[scenario.name] = createStats();
    const workers = Array.from({ length: CONCURRENCY }, () =>
      worker(scenario, allStats[scenario.name], endAt)
    );
    await Promise.all(workers);
  }

  for (const [name, stats] of Object.entries(allStats)) {
    const sorted = [...stats.latencies].sort((a, b) => a - b);
    const rps = stats.count / DURATION_SEC;
    logger.info({
      scenario: name,
      requests: stats.count,
      errors: stats.errors,
      rps: Number(rps.toFixed(1)),
      avgMs: stats.count ? Number((stats.totalMs / stats.count).toFixed(1)) : 0,
      p95Ms: Number(percentile(sorted, 95).toFixed(1)),
      p99Ms: Number(percentile(sorted, 99).toFixed(1)),
    }, "Load test scenario complete");
  }
}

main().catch((error) => {
  logger.error({ err: error }, "Load test failed");
  process.exitCode = 1;
});
