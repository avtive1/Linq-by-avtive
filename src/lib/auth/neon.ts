import { createNeonAuth } from "@neondatabase/auth/next/server";

const isNextBuild =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

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
