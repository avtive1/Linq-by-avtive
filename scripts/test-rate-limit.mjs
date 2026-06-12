// Simple rate limiting test script
// Usage: node scripts/test-rate-limit.mjs

import { logger } from "./lib/logger.mjs";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_PATH = process.env.TEST_PATH || "/api/auth/register";
const REQUEST_COUNT = parseInt(process.env.TEST_REQUESTS || "10", 10);

logger.info({ baseUrl: BASE_URL, testPath: TEST_PATH, requestCount: REQUEST_COUNT }, "Rate limit test started");

async function sendRequest(index) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${TEST_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: `test-${index}@example.com` }),
    });
    const duration = Date.now() - start;
    const isRateLimited = res.status === 429;

    const headers = {
      "X-RateLimit-Limit": res.headers.get("X-RateLimit-Limit"),
      "X-RateLimit-Remaining": res.headers.get("X-RateLimit-Remaining"),
      "X-RateLimit-Reset": res.headers.get("X-RateLimit-Reset"),
      "Retry-After": res.headers.get("Retry-After"),
    };

    logger.info({
      requestIndex: index + 1,
      status: res.status,
      statusText: res.statusText,
      durationMs: duration,
      ...(Object.values(headers).some((h) => h) ? { rateLimitHeaders: headers } : {}),
    }, "Rate limit test request");

    return { index, status: res.status, isRateLimited };
  } catch (err) {
    logger.error({ requestIndex: index + 1, err }, "Rate limit test request failed");
    return { index, error: err.message };
  }
}

async function main() {
  const results = [];
  for (let i = 0; i < REQUEST_COUNT; i++) {
    results.push(await sendRequest(i));
    await new Promise((r) => setTimeout(r, 100));
  }

  const rateLimited = results.filter((r) => r.isRateLimited).length;
  const successful = results.filter((r) => r.status && r.status < 400).length;
  const errors = results.filter((r) => r.error || (r.status && r.status >= 400 && r.status !== 429)).length;

  logger.info({
    totalRequests: REQUEST_COUNT,
    rateLimited,
    successful,
    errors,
  }, "Rate limit test summary");

  if (rateLimited > 0) {
    logger.info("Rate limiting is working");
  } else {
    logger.warn({
      hints: [
        "Is RATE_LIMIT_IN_DEV=true in .env?",
        "Are UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN configured?",
        "Is the dev server running?",
      ],
    }, "No rate limits triggered");
  }
}

main().catch((err) => {
  logger.error({ err }, "Rate limit test failed");
  process.exitCode = 1;
});
