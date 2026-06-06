// Simple rate limiting test script
// Usage: node scripts/test-rate-limit.mjs

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_PATH = process.env.TEST_PATH || "/api/auth/register";
const REQUEST_COUNT = parseInt(process.env.TEST_REQUESTS || "10", 10);

console.log(`Testing rate limiting on: ${BASE_URL}${TEST_PATH}`);
console.log(`Sending ${REQUEST_COUNT} requests...\n`);

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

    console.log(`Request ${index + 1}: ${res.status} ${res.statusText} (${duration}ms)`);

    // Log rate limit headers if present
    const headers = {
      "X-RateLimit-Limit": res.headers.get("X-RateLimit-Limit"),
      "X-RateLimit-Remaining": res.headers.get("X-RateLimit-Remaining"),
      "X-RateLimit-Reset": res.headers.get("X-RateLimit-Reset"),
      "Retry-After": res.headers.get("Retry-After"),
    };
    if (Object.values(headers).some(h => h)) {
      console.log("  Headers:", JSON.stringify(headers, null, 2));
    }

    return { index, status: res.status, isRateLimited };
  } catch (err) {
    console.log(`Request ${index + 1}: ERROR - ${err.message}`);
    return { index, error: err.message };
  }
}

async function main() {
  const results = [];
  for (let i = 0; i < REQUEST_COUNT; i++) {
    results.push(await sendRequest(i));
    // Small delay between requests to make logs readable
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\n--- Summary ---");
  const rateLimited = results.filter(r => r.isRateLimited).length;
  const successful = results.filter(r => r.status && r.status < 400).length;
  const errors = results.filter(r => r.error || (r.status && r.status >= 400 && r.status !== 429)).length;

  console.log(`Total requests: ${REQUEST_COUNT}`);
  console.log(`Rate limited (429): ${rateLimited}`);
  console.log(`Successful: ${successful}`);
  console.log(`Other errors: ${errors}`);

  if (rateLimited > 0) {
    console.log("\n✅ Rate limiting is working!");
  } else {
    console.log("\n⚠️ No rate limits triggered. Check:");
    console.log("   - Is RATE_LIMIT_IN_DEV=true in .env?");
    console.log("   - Are UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN configured?");
    console.log("   - Is the dev server running?");
  }
}

main().catch(console.error);
