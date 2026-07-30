import { createNeonAuth } from "@neondatabase/auth/next/server";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
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
