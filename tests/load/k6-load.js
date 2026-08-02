/**
 * k6 load test — sustained traffic with ramp-up/down.
 *
 * Run:
 *   k6 run tests/load/k6-load.js
 *   k6 run -e BASE_URL=https://your-app.vercel.app tests/load/k6-load.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const errorRate = new Rate("errors");
const requestDuration = new Trend("request_duration", true);
const requestCount = new Counter("request_count");

export const options = {
  stages: [
    { duration: __ENV.K6_RAMP_UP || "30s", target: Number(__ENV.K6_TARGET_VUS || 20) },
    { duration: __ENV.K6_STEADY || "2m", target: Number(__ENV.K6_TARGET_VUS || 20) },
    { duration: __ENV.K6_RAMP_DOWN || "30s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.10"],
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.10"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const SCENARIOS = [
  { weight: 55, name: "auth_session", path: "/api/auth/session", method: "GET" },
  { weight: 30, name: "profile_username_unauth", path: "/api/profile/username", method: "GET" },
  { weight: 15, name: "events_unauth", path: "/api/events", method: "GET" },
];

function pickScenario() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const scenario of SCENARIOS) {
    cumulative += scenario.weight;
    if (roll <= cumulative) return scenario;
  }
  return SCENARIOS[0];
}

export default function load() {
  const scenario = pickScenario();
  const res = http.request(scenario.method, `${BASE_URL}${scenario.path}`, null, {
    tags: { scenario: scenario.name },
    timeout: "15s",
  });

  requestCount.add(1, { scenario: scenario.name });
  requestDuration.add(res.timings.duration, { scenario: scenario.name });

  const ok = check(res, {
    "status is not 5xx": (r) => r.status < 500,
  });

  errorRate.add(!ok);

  // Unauthenticated reads should be 401/403/200 depending on route — never 5xx.
  if (res.status >= 500) {
    console.warn(`5xx on ${scenario.name}: ${res.status}`);
  }

  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const errs = data.metrics.errors?.values?.rate ?? 0;
  const rps = data.metrics.http_reqs?.values?.rate ?? 0;
  const total = data.metrics.http_reqs?.values?.count ?? 0;

  return {
    stdout: [
      "k6 load summary",
      `total_requests: ${total}`,
      `error_rate: ${(errs * 100).toFixed(2)}%`,
      `p95_latency_ms: ${p95.toFixed(1)}`,
      `throughput_rps: ${rps.toFixed(2)}`,
    ].join("\n") + "\n",
  };
}
