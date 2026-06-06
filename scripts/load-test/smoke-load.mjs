import { performance } from "node:perf_hooks";

const BASE = process.env.LOAD_TEST_BASE_URL || "http://localhost:3000";
const DURATION_SEC = Number(process.env.LOAD_TEST_DURATION_SEC || 30);
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || 10);

const SCENARIOS = [
  { name: "health_session", path: "/api/auth/session", method: "GET" },
  { name: "public_event_short", path: "/ev/testslug", method: "GET", expectRedirect: true },
];

type Stats = {
  count: number;
  errors: number;
  totalMs: number;
  latencies: number[];
};

function createStats(): Stats {
  return { count: 0, errors: 0, totalMs: 0, latencies: [] };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runRequest(scenario: (typeof SCENARIOS)[number]): Promise<number> {
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

async function worker(
  scenario: (typeof SCENARIOS)[number],
  stats: Stats,
  endAt: number,
) {
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
  console.log(`Load test: ${BASE} | ${DURATION_SEC}s | concurrency ${CONCURRENCY}\n`);
  const endAt = performance.now() + DURATION_SEC * 1000;
  const allStats: Record<string, Stats> = {};

  for (const scenario of SCENARIOS) {
    allStats[scenario.name] = createStats();
    const workers = Array.from({ length: CONCURRENCY }, () =>
      worker(scenario, allStats[scenario.name], endAt),
    );
    await Promise.all(workers);
  }

  for (const [name, stats] of Object.entries(allStats)) {
    const sorted = [...stats.latencies].sort((a, b) => a - b);
    const rps = stats.count / DURATION_SEC;
    console.log(`[${name}]`);
    console.log(`  requests: ${stats.count}`);
    console.log(`  errors:   ${stats.errors}`);
    console.log(`  rps:      ${rps.toFixed(1)}`);
    console.log(`  avg ms:   ${stats.count ? (stats.totalMs / stats.count).toFixed(1) : 0}`);
    console.log(`  p95 ms:   ${percentile(sorted, 95).toFixed(1)}`);
    console.log(`  p99 ms:   ${percentile(sorted, 99).toFixed(1)}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
