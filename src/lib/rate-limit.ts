import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

export type RateLimitTier = "general" | "auth" | "sensitive" | "registration" | "upload";

type Limiters = Record<RateLimitTier, Ratelimit>;

declare global {
  var __avtiveRatelimitLimiters: Limiters | undefined;
}

function readLimit(envKey: string, fallback: number) {
  const raw = Number(process.env[envKey]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
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

function buildLimiter(redis: Redis, prefix: string, requestsPerMinute: number) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requestsPerMinute, "1 m"),
    prefix: `avtive:ratelimit:${prefix}`,
  });
}

/**
 * Redis-backed rate limits (optional). Configure Upstash REST credentials to enable in production.
 * Local dev stays unlimited unless RATE_LIMIT_IN_DEV=true.
 */
export function getRateLimiters(): Limiters | null {
  if (!shouldApplyRateLimit()) return null;
  if (globalThis.__avtiveRatelimitLimiters) {
    return globalThis.__avtiveRatelimitLimiters;
  }

  const redis = Redis.fromEnv();
  globalThis.__avtiveRatelimitLimiters = {
    general: buildLimiter(redis, "general", readLimit("RATELIMIT_GENERAL_PER_MIN", 100)),
    auth: buildLimiter(redis, "auth", readLimit("RATELIMIT_AUTH_PER_MIN", 5)),
    sensitive: buildLimiter(redis, "sensitive", readLimit("RATELIMIT_SENSITIVE_PER_MIN", 5)),
    registration: buildLimiter(redis, "registration", readLimit("RATELIMIT_REGISTRATION_PER_MIN", 30)),
    upload: buildLimiter(redis, "upload", readLimit("RATELIMIT_UPLOAD_PER_MIN", 20)),
  };
  return globalThis.__avtiveRatelimitLimiters;
}

const SENSITIVE_AUTH_PATHS = new Set([
  "/api/auth/register",
  "/api/auth/register-invited",
  "/api/auth/migrate-legacy-login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

export function classifyApiRoute(pathname: string, method: string): RateLimitTier {
  if (pathname.startsWith("/api/media/upload")) return "upload";
  if (pathname.includes("/registrations")) return "registration";
  if (pathname === "/api/cards" && method.toUpperCase() === "POST") return "registration";
  if (SENSITIVE_AUTH_PATHS.has(pathname)) return "sensitive";
  if (pathname.startsWith("/api/auth")) return "auth";
  return "general";
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

export function rateLimitKey(tier: RateLimitTier, ip: string) {
  return `${tier}:${ip}`;
}
