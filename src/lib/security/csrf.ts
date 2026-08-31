export function validateCsrfOrigin(req: Request): { ok: boolean; reason?: string } {
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");
  const headerUrl = originHeader || refererHeader;

  if (!headerUrl) {
    return { ok: false, reason: "Missing Origin/Referer header." };
  }

  let incomingOrigin: string;
  let incomingHost: string;
  try {
    const parsed = new URL(headerUrl);
    incomingOrigin = parsed.origin;
    incomingHost = parsed.host.toLowerCase();
  } catch {
    return { ok: false, reason: "Invalid Origin/Referer header." };
  }

  // 1. Direct match with req.url origin or host
  try {
    const requestUrl = new URL(req.url);
    if (incomingOrigin === requestUrl.origin || incomingHost === requestUrl.host.toLowerCase()) {
      return { ok: true };
    }
  } catch {}

  // 2. Forwarded host / Host header match
  const forwardedHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase().trim();
  if (forwardedHost && (incomingHost === forwardedHost || incomingHost.split(":")[0] === forwardedHost.split(":")[0])) {
    return { ok: true };
  }

  // 3. Configured app URL match
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "").trim();
  if (appUrl) {
    try {
      const parsedApp = new URL(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`);
      if (incomingHost === parsedApp.host.toLowerCase() || incomingOrigin === parsedApp.origin) {
        return { ok: true };
      }
    } catch {}
  }

  // 4. Default production domains and localhost
  if (
    incomingHost === "linq.avtive.app" ||
    incomingHost.endsWith(".avtive.app") ||
    incomingHost === "localhost" ||
    incomingHost.startsWith("localhost:")
  ) {
    return { ok: true };
  }

  return { ok: false, reason: "Origin mismatch." };
}
