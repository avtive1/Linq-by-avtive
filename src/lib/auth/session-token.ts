import { SignJWT, jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const secret =
    process.env.NEON_AUTH_COOKIE_SECRET ||
    process.env.SECURITY_HMAC_KEY ||
    "default-auth-session-secret-key-32-chars-long";
  return new TextEncoder().encode(secret.padEnd(32, "!"));
}

export const AUTH_COOKIE_NAME = "linq_session_token";

export async function createSessionToken(
  userId: string,
  email: string,
): Promise<string> {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.userId || !payload.email) return null;
    return {
      userId: String(payload.userId),
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}
