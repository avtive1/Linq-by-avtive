/**
 * Public URL for magic links and emails. Set `NEXT_PUBLIC_APP_URL` in production
 * (e.g. https://app.example.com).
 */
export function getPublicAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
