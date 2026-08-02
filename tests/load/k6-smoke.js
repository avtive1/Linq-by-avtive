/**
 * k6 smoke test — light traffic, health/session checks.
 *
 * Run:
 *   k6 run tests/load/k6-smoke.js
 *   k6 run -e BASE_URL=https://your-app.vercel.app tests/load/k6-smoke.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const requestDuration = new Trend("request_duration", true);

export const options = {
  vus: Number(__ENV.K6_VUS || 3),
  duration: __ENV.K6_DURATION || "30s",
  thresholds: {
    errors: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const SCENARIOS = [
  { name: "auth_session", path: "/api/auth/session", method: "GET" },
];

export default function smoke() {
  for (const scenario of SCENARIOS) {
    const res = http.request(scenario.method, `${BASE_URL}${scenario.path}`, null, {
      tags: { scenario: scenario.name },
      timeout: "10s",
    });

    requestDuration.add(res.timings.duration, { scenario: scenario.name });

    const ok = check(res, {
      [`${scenario.name} status < 500`]: (r) => r.status < 500,
      [`${scenario.name} responds`]: (r) => r.body && r.body.length >= 0,
    });

    errorRate.add(!ok);
  }

  sleep(1);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const errs = data.metrics.errors?.values?.rate ?? 0;
  const rps = data.metrics.http_reqs?.values?.rate ?? 0;

  return {
    stdout: [
      "k6 smoke summary",
      `error_rate: ${(errs * 100).toFixed(2)}%`,
      `p95_latency_ms: ${p95.toFixed(1)}`,
      `throughput_rps: ${rps.toFixed(2)}`,
    ].join("\n") + "\n",
  };
}
