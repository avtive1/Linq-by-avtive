/**
 * Canonical production domain for LINQ.
 */
export const CANONICAL_APP_URL = "https://linq.avtive.app";

/**
 * Normalizes an app URL, ensuring correct scheme and replacing any legacy/erroneous
 * `.com` domain variants with `.app` (e.g. `linq.avtive.com` -> `linq.avtive.app`, `avtive.com` -> `avtive.app`).
 */
export function normalizeAppUrl(url: string): string {
  let cleaned = String(url || "").trim();
  if (!cleaned) return CANONICAL_APP_URL;

  // Replace any erroneous avtive.com domain references with avtive.app
  cleaned = cleaned.replace(/\blinq\.avtive\.com\b/gi, "linq.avtive.app");
  cleaned = cleaned.replace(/\bavtive\.com\b/gi, "avtive.app");

  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }

  return cleaned.replace(/\/$/, "");
}

/**
 * Public URL for magic links, invitations, and transactional emails.
 * Uses `NEXT_PUBLIC_APP_URL` or `APP_URL`, auto-corrects any `.com` references to `.app`,
 * and defaults to `https://linq.avtive.app` in production.
 */
export function getPublicAppUrl(reqOrHeaders?: Request | Headers | null): string {
  if (reqOrHeaders) {
    const headers = "headers" in reqOrHeaders ? reqOrHeaders.headers : reqOrHeaders;
    const origin = headers.get("origin")?.trim();
    if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return normalizeAppUrl(origin);
    }
    const forwardedHost = headers.get("x-forwarded-host")?.trim() || headers.get("host")?.trim();
    if (forwardedHost && !forwardedHost.includes("localhost") && !forwardedHost.includes("127.0.0.1")) {
      const proto = headers.get("x-forwarded-proto")?.trim() || "https";
      return normalizeAppUrl(`${proto}://${forwardedHost}`);
    }
  }

  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
    (process.env.NODE_ENV === "production" ? CANONICAL_APP_URL : "http://localhost:3000");

  return normalizeAppUrl(raw);
}

