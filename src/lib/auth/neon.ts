import { createNeonAuth } from "@neondatabase/auth/next/server";
import { validateRequiredEnv } from "@/lib/env";

const isNextBuild =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

if (!isNextBuild) {
  validateRequiredEnv([
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
    "DATABASE_URL",
    "DATABASE_URL_DIRECT",
  ]);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    if (isNextBuild) {
      if (name === "NEON_AUTH_BASE_URL") return "https://build-placeholder.neon-auth.invalid";
      if (name === "NEON_AUTH_COOKIE_SECRET") {
        return "build-placeholder-neon-auth-cookie-secret-minimum-32-chars";
      }
    }
    throw new Error(`${name} is required for Neon Auth.`);
  }
  return value;
}

export const neonAuth = createNeonAuth({
  baseUrl: requiredEnv("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: requiredEnv("NEON_AUTH_COOKIE_SECRET"),
    sessionDataTtl: 300,
  },
  logLevel: process.env.NEON_AUTH_LOG_LEVEL === "debug" ? "debug" : "warn",
});

// Circuit Breaker + Timeout wrapper to prevent blocking calls on Neon Auth failure
let lastFailureTime = 0;
const BREAKER_COOLDOWN_MS = 30000; // 30 seconds

const originalGetSession = neonAuth.getSession.bind(neonAuth);

(neonAuth as any).getSession = async function (...args: any[]) {
  const now = Date.now();
  if (now - lastFailureTime < BREAKER_COOLDOWN_MS) {
    return { data: null };
  }

  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<{ data: null }>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ data: null });
    }, 800);
  });

  const start = Date.now();
  try {
    const res = await Promise.race([
      originalGetSession(...args),
      timeoutPromise,
    ]);
    if (timeoutId) clearTimeout(timeoutId);

    // If request took longer than 800ms, assume it timed out or is extremely slow
    if (Date.now() - start >= 800) {
      lastFailureTime = Date.now();
    }
    return res;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    lastFailureTime = Date.now();
    throw err;
  }
};

