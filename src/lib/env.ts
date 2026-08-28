type ValidationOptions = {
  env?: Record<string, string | undefined>;
  throwOnMissing?: boolean;
};

export function getMissingRequiredEnv(
  requiredKeys: string[],
  env: Record<string, string | undefined> = process.env,
): string[] {
  return requiredKeys.filter((key) => {
    const value = env[key];
    return value === undefined || value.trim() === "";
  });
}

export function validateRequiredEnv(
  requiredKeys: string[],
  options: ValidationOptions = {},
): void {
  const env = options.env ?? process.env;
  const missing = getMissingRequiredEnv(requiredKeys, env);

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(", ")}. Create a local .env file or set them in your shell before running the app.`;
    if (options.throwOnMissing !== false) {
      throw new Error(message);
    }
  }
}

export function requireAppEnv(): void {
  const required = [
    "DATABASE_URL",
    "DATABASE_URL_DIRECT",
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "SECURITY_KEKS_JSON",
    "SECURITY_ACTIVE_KEK_ID",
    "SECURITY_HMAC_KEY",
    "ATTENDEE_TOKEN_KEYS_JSON",
    "ATTENDEE_TOKEN_ACTIVE_KID",
    "PASSWORD_PEPPER",
    "NEXT_PUBLIC_APP_URL",
  ];

  validateRequiredEnv(required);
}
