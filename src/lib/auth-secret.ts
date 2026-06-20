const DEV_FALLBACK_MESSAGE =
  "Missing NEXTAUTH_SECRET (or AUTH_SECRET). Add NEXTAUTH_SECRET to .env.local — run: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"";

const DEV_INSECURE_FALLBACK = "dev-insecure-nextauth-secret-set-env-local";

let warnedMissingSecret = false;

export function resolveAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(DEV_FALLBACK_MESSAGE);
  }

  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      "[auth] NEXTAUTH_SECRET is not set. Using an insecure dev fallback — add NEXTAUTH_SECRET to .env.local for stable sessions.",
    );
  }

  return DEV_INSECURE_FALLBACK;
}
