import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

type Limiters = { general: Ratelimit; auth: Ratelimit };

declare global {
  var __avtiveRatelimitGeneral: Ratelimit | undefined;
  var __avtiveRatelimitAuth: Ratelimit | undefined;
}

function shouldApplyRateLimit(): boolean {
  if (process.env.RATE_LIMIT_ENABLED === "false") return false;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return false;
  }
  if (process.env.NODE_ENV !== "production" && process.env.RATE_LIMIT_IN_DEV !== "true") {
    return false;
  }
  return true;
}

/**
 * Redis-backed rate limits (optional). Configure Upstash REST credentials to enable in production.
 * Local dev stays unlimited unless RATE_LIMIT_IN_DEV=true.
 */
export function getRateLimiters(): Limiters | null {
  if (!shouldApplyRateLimit()) return null;
  const redis = Redis.fromEnv();
  if (!globalThis.__avtiveRatelimitGeneral) {
    globalThis.__avtiveRatelimitGeneral = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(150, "1 m"),
      prefix: "avtive:ratelimit:general",
    });
  }
  if (!globalThis.__avtiveRatelimitAuth) {
    globalThis.__avtiveRatelimitAuth = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(40, "1 m"),
      prefix: "avtive:ratelimit:auth",
    });
  }
  return {
    general: globalThis.__avtiveRatelimitGeneral,
    auth: globalThis.__avtiveRatelimitAuth,
  };
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
